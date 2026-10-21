# NowThere AWS 아키텍처 (서버리스 → EC2 확장형)

> 2026-10 작성. 이전 우분투 노트북 + docker-compose 구성을 대체합니다.
> (이전 구성은 로컬 `legacy/` 폴더에만 보관, 저장소에는 포함하지 않음)

## 1. 목표

- **최소 비용**: 사용자가 없을 때 월 비용이 거의 0원. 상시 켜져 있는 서버 없음.
- **"실시간" 검증을 서버가 직접 판정**: 사진 원본 EXIF + S3 수신 시각 기반.
- **확장 경로 확보**: 같은 API 코드가 Lambda와 EC2(일반 Node 서버) 양쪽에서 동작.
- **이력서용 키워드**: Lambda, API Gateway, DynamoDB(single-table, GSI, TTL), S3 이벤트, CloudFront OAC, Cognito, IAM 최소 권한, AWS CDK(IaC), Budgets, GitHub Actions.

## 2. 구성도

```text
 [Mobile App (Expo)]
   │  ① 로그인 (Cognito USER_PASSWORD_AUTH, fetch)
   │  ② GET /v1/map/pins, /posts/nearby, /posts/popular  (공개)
   │  ③ POST /v1/posts  (JWT) ─────────────┐
   │  ④ 사진 원본 → S3 presigned POST ─┐    │
   ▼                                    │    ▼
 API Gateway HTTP API ── JWT Authorizer(Cognito) ── Lambda: ApiFn (Hono)
                                        │                │
                                        ▼                ▼
                              S3: UploadBucket      DynamoDB (single table)
                              (비공개, 1일 후 삭제)        ▲
                                        │ ObjectCreated  │
                                        ▼                │
                              Lambda: MediaProcessorFn ──┘
                                - EXIF 촬영시각/GPS 추출
                                - 검증 판정 (S3 eventTime 기준)
                                - EXIF·GPS 제거 사본 생성
                                        │
                                        ▼
                              S3: MediaBucket (비공개) ── CloudFront (OAC) ── 앱에서 이미지 표시
```

## 3. 실시간 검증 흐름

1. 앱이 `POST /v1/posts`로 게시물 메타데이터(장소, 기기 GPS, 정확도, 앱이 읽은 촬영 시각, UTC 오프셋)를 보냄 → `pending_media` 상태로 저장, presigned POST 발급(5분 유효, 12MB 제한을 S3가 강제).
2. 앱이 원본 JPEG를 S3에 직접 업로드 (Lambda를 거치지 않으므로 Lambda 비용·용량 제한 없음).
3. S3 이벤트로 MediaProcessor 실행. **수신 시각 = S3 `eventTime`** (클라이언트가 조작 불가).
4. 원본 파일의 EXIF에서 촬영 시각·GPS를 서버가 직접 추출.
5. 판정 (`backend/src/core/verification.ts`): 신호별로 상한을 정하고 가장 낮은 상한을 채택

| 신호 | 지금 검증됨 | 근처 검증됨 | 미검증 |
|---|---|---|---|
| 촬영→수신 경과 | ≤ 10분 | ≤ 60분 | 60분 초과, 미래 시각(2분 초과), 시각 없음 |
| 기기 GPS ↔ 장소 | ≤ 300m | ≤ 2km | 2km 초과, 위치 없음 |
| 사진 EXIF GPS ↔ 장소 (있을 때) | ≤ 300m | ≤ 2km | 2km 초과 |
| 기타 | | GPS 정확도 150m 초과 / 파일에 EXIF가 없어 앱 보고 시각 사용 | |

6. 공개용 사본은 **EXIF·GPS·코멘트를 제거하고 Orientation만 남겨** MediaBucket에 저장 → CloudFront로 제공. 원본은 즉시 삭제(+1일 수명주기 안전장치).
7. 게시물이 `published`가 되면서 지도용 인덱스(GSI1/GSI3)에 처음 노출됨.

개인정보: 공개 API는 좌표를 소수 3자리(약 110m)로 반올림하고, 기기 위치·정확 좌표는 절대 반환하지 않음.

## 4. DynamoDB 설계 (single-table)

| 항목 | PK | SK | GSI1 (지도) | GSI2 (내 글) | GSI3 (최근 전체) |
|---|---|---|---|---|---|
| 게시물 | `POST#<id>` | `META` | `GEO#<geohash4>` / `createdAt#id` | `USER#<sub>` / `createdAt#id` | `RECENT#<YYYY-MM-DD>` / `createdAt#id` |
| 좋아요 | `POST#<id>` | `LIKE#<sub>` | – | – | – |

- **지도 핀** `GET /v1/map/pins?bbox=`: 화면 bbox를 덮는 geohash-4 셀(약 39×20km)이 24개 이하이면 셀별 Query(최근 24시간만), 그보다 넓게 축소하면 GSI3(최근 전체)로 조회. 그 후 서버에서 **4×4 그리드 · 셀당 최대 3핀 · 근접 핀 병합**(`core/pins.ts`).
- **좋아요**: TransactWrite(LIKE 아이템 조건부 생성 + likeCount 증가)로 중복 방지.
- **TTL**: 게시 90일, 업로드 미완료 1일 후 자동 삭제 → 저장 비용 상한.
- **레이트 리밋**: 사용자당 10분 10개(GSI2 조회), API 전체 초당 20건/버스트 50건(API Gateway 스로틀).

## 5. 비용 (저트래픽 기준)

모든 리소스가 사용량 과금이며 상시 비용이 없습니다. 아래 무료 할당량은 기간 제한 없는 항목이며, 2025-07 이후 신규 계정은 별도로 크레딧이 지급됩니다.

| 서비스 | 무료 범위 | 이 프로젝트에서 |
|---|---|---|
| Lambda | 월 100만 요청 + 40만 GB-초 | ARM64, 512MB/1024MB |
| DynamoDB | 25GB 저장 | 온디맨드(요청당 과금, 소량이면 수 센트) |
| CloudFront | 월 1TB 전송 + 1천만 요청 | 이미지 전송 |
| Cognito (Lite) | 월 1만 MAU | 이메일 가입/로그인 |
| CloudWatch Logs | 5GB | 보관 2주로 제한 |
| AWS Budgets | 예산 2개 | $5 예산, 50%/100%/예측 100% 알림 |
| API Gateway HTTP API | (신규 12개월 무료 이후) 100만 건당 약 $1 | |
| S3 | 저장 GB당 약 $0.025 | 원본은 즉시 삭제, 공개본만 보관 |

**의도적으로 쓰지 않은 것**: NAT Gateway(월 $30+), RDS(최소 월 $15+), 공인 IPv4(EC2당 월 약 $3.6), VPC 안의 Lambda.

## 6. EC2로 확장하는 시점과 방법

**언제**: Lambda+API Gateway 월 비용이 t4g.small 1대(+ALB) 비용을 넘을 때, 또는 WebSocket 실시간 푸시가 필요할 때.

**코드 변경 없이 가능한 이유**: API는 `createApp(service, resolveUser)` 하나이고, 런타임별 진입점만 다릅니다.

| 진입점 | 저장소 | 미디어 | 인증 |
|---|---|---|---|
| `handlers/lambda.ts` | DynamoDB | S3 | API Gateway JWT Authorizer가 검증한 claims 사용 |
| `local.ts` (EC2/로컬) | `TABLE_NAME` 있으면 DynamoDB, 없으면 메모리 | `UPLOAD_BUCKET` 있으면 S3, 없으면 로컬 디스크 | `COGNITO_*` 있으면 aws-jwt-verify, 없으면 dev 토큰 |

단계:
1. `backend/Dockerfile`로 이미지 빌드 → EC2(또는 ECS Fargate)에서 실행, 같은 DynamoDB/S3/Cognito 환경변수 지정, 인스턴스 역할에 동일 권한 부여.
2. ALB 뒤에 두고 앱의 `EXPO_PUBLIC_API_URL`만 변경 (또는 HTTP API에서 ALB로 HTTP 통합).
3. MediaProcessor Lambda는 그대로 유지 (S3 이벤트 기반이라 EC2보다 저렴).
4. 지리 쿼리가 복잡해지면 `PostRepository` 인터페이스에 PostGIS 어댑터를 추가 (핸들러 수정 없음).

## 7. 다음 단계 후보

- 썸네일 생성(Lambda + sharp 레이어) — 지금은 원본 해상도 이미지를 CloudFront로 제공
- Rekognition `DetectModerationLabels`로 유해 이미지 자동 차단 (처리 Lambda에 한 단계 추가)
- 영상 업로드, 날씨 API 연동, 실시간 푸시(API Gateway WebSocket)
- GitHub Actions OIDC로 main 머지 시 자동 배포
- 같은 사진 재사용 탐지(perceptual hash)
