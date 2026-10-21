import { useCallback } from "react";
import { Alert } from "react-native";

import { ApiError, api } from "../api/client";
import type { Post } from "../api/types";

/** Optimistic like; asks to log in on 401 */
export function useLike(setPosts: (fn: (prev: Post[]) => Post[]) => void, onRequireLogin: () => void) {
  return useCallback(
    async (post: Post) => {
      try {
        const res = await api.like(post.id);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likeCount: res.likeCount } : p)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) onRequireLogin();
        else Alert.alert("좋아요 실패", (e as Error).message);
      }
    },
    [setPosts, onRequireLogin]
  );
}
