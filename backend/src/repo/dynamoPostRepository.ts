import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";

import type { Post } from "../core/types.js";
import { GEO_INDEX_PRECISION, type PostRepository } from "./postRepository.js";

/**
 * Single-table design
 *
 *  item          PK            SK            GSI1 (geo)              GSI2 (user)        GSI3 (recent)
 *  post          POST#<id>     META          GEO#<gh4> / ts#id       USER#<uid> / ts#id  RECENT#<yyyy-mm-dd> / ts#id
 *  like          POST#<id>     LIKE#<uid>    -                       -                  -
 *
 *  GSI1 and GSI3 keys are only written once a post is published (sparse indexes),
 *  so pending uploads never show up on the map.
 */
const PUBLISHED_TTL_DAYS = 90;
const PENDING_TTL_DAYS = 1;

type PostItem = Post & {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK: string;
  GSI2SK: string;
  GSI3PK?: string;
  GSI3SK?: string;
  ttl: number;
};

export class DynamoPostRepository implements PostRepository {
  private doc: DynamoDBDocumentClient;

  constructor(
    private tableName: string,
    client = new DynamoDBClient({})
  ) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async create(post: Post) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toItem(post),
        ConditionExpression: "attribute_not_exists(PK)"
      })
    );
  }

  async save(post: Post) {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: toItem(post) }));
  }

  async get(id: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: `POST#${id}`, SK: "META" } })
    );
    return res.Item ? fromItem(res.Item as PostItem) : null;
  }

  async getMany(ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 100);
    if (unique.length === 0) return [];
    const res = await this.doc.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: { Keys: unique.map((id) => ({ PK: `POST#${id}`, SK: "META" })) }
        }
      })
    );
    const items = (res.Responses?.[this.tableName] ?? []) as PostItem[];
    const byId = new Map(items.map((i) => [i.id, fromItem(i)]));
    return unique.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }

  async queryByGeohashes(cells: string[], since: Date, limitPerCell: number) {
    const results = await Promise.all(
      cells.map((cell) =>
        this.query("GSI1", "GSI1PK", `GEO#${cell}`, "GSI1SK", since.toISOString(), limitPerCell)
      )
    );
    return results.flat();
  }

  async queryRecent(since: Date, limit: number) {
    const days: string[] = [];
    const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
    const today = new Date();
    while (cursor <= today && days.length < 8) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const results = await Promise.all(
      days.reverse().map((d) => this.query("GSI3", "GSI3PK", `RECENT#${d}`, "GSI3SK", since.toISOString(), limit))
    );
    return results
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async queryByUser(userId: string, limit: number) {
    return this.query("GSI2", "GSI2PK", `USER#${userId}`, "GSI2SK", "", limit);
  }

  async addLike(postId: string, userId: string) {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { PK: `POST#${postId}`, SK: `LIKE#${userId}`, createdAt: new Date().toISOString() },
                ConditionExpression: "attribute_not_exists(PK)"
              }
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `POST#${postId}`, SK: "META" },
                UpdateExpression: "SET likeCount = likeCount + :one",
                ConditionExpression: "attribute_exists(PK)",
                ExpressionAttributeValues: { ":one": 1 }
              }
            }
          ]
        })
      );
      return true;
    } catch (err) {
      if ((err as { name?: string }).name === "TransactionCanceledException") return false;
      throw err;
    }
  }

  private async query(index: string, pkName: string, pk: string, skName: string, skFrom: string, limit: number) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: index,
        KeyConditionExpression: skFrom ? `#pk = :pk AND #sk >= :sk` : `#pk = :pk`,
        ExpressionAttributeNames: skFrom ? { "#pk": pkName, "#sk": skName } : { "#pk": pkName },
        ExpressionAttributeValues: skFrom ? { ":pk": pk, ":sk": skFrom } : { ":pk": pk },
        ScanIndexForward: false,
        Limit: limit
      })
    );
    return ((res.Items ?? []) as PostItem[]).map(fromItem);
  }
}

function toItem(post: Post): PostItem {
  const sortKey = `${post.createdAt}#${post.id}`;
  const published = post.status === "published";
  const ttlDays = published ? PUBLISHED_TTL_DAYS : PENDING_TTL_DAYS;
  return {
    ...post,
    PK: `POST#${post.id}`,
    SK: "META",
    GSI2PK: `USER#${post.userId}`,
    GSI2SK: sortKey,
    ...(published
      ? {
          GSI1PK: `GEO#${post.geohash.slice(0, GEO_INDEX_PRECISION)}`,
          GSI1SK: sortKey,
          GSI3PK: `RECENT#${post.createdAt.slice(0, 10)}`,
          GSI3SK: sortKey
        }
      : {}),
    ttl: Math.floor(Date.now() / 1000) + ttlDays * 86_400
  };
}

function fromItem(item: PostItem): Post {
  const { PK: _pk, SK: _sk, GSI1PK: _1, GSI1SK: _2, GSI2PK: _3, GSI2SK: _4, GSI3PK: _5, GSI3SK: _6, ttl: _t, ...post } =
    item;
  return post;
}
