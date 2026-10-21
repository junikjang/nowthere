# NowThere

"지금 거기, 무슨 일이?" — 장소별 사건·날씨·일상을 실시간으로 공유하는 위치 기반 SNS.
핵심은 **실시간성 검증**: 서버가 사진 원본의 EXIF 촬영 시각·GPS와 S3 수신 시각, 기기 위치를 대조해 배지를 부여합니다.

## 구조

| 폴더 | 내용 |
|---|---|
| `app/` | Expo(React Native) 앱 — 지도 핀, 인기/내 주변 피드, 촬영·업로드, Cognito 로그인 |
| `backend/` | API + 검증 로직 (TypeScript, Hono). Lambda와 일반 Node 서버(EC2) 겸용 |
| `infra/` | AWS CDK — Lambda, HTTP API, DynamoDB, S3, CloudFront, Cognito, Budgets |
| `docs/` | 기획 문서, [AWS 아키텍처](docs/aws-architecture.md), [실행·배포 가이드](docs/aws-deploy-guide.md) |
| `.github/workflows/` | CI — 백엔드 테스트, CDK synth, 앱 타입체크 |

## 빠른 시작

```bash
cd backend && npm install && npm test && npm run dev    # AWS 없이 로컬 실행
cd infra && npm install && npm run deploy -- -c alertEmail=you@example.com   # AWS 배포
```

자세한 내용은 [docs/aws-deploy-guide.md](docs/aws-deploy-guide.md).

## 기술 요약

- **서버리스 / 저비용**: 상시 서버 없음, 저트래픽에서 월 $0~1 수준. NAT·RDS·공인 IPv4 미사용
- **DynamoDB single-table**: geohash GSI로 지도 bbox 조회, sparse index, TTL, 트랜잭션 좋아요
- **이벤트 기반 미디어 처리**: S3 presigned POST → S3 이벤트 → Lambda가 EXIF 검증 + 메타데이터 제거
- **보안**: Cognito JWT를 API Gateway에서 검증, IAM 최소 권한, 비공개 버킷 + CloudFront OAC, 공개 좌표 반올림
- **이식성**: 저장소·스토리지·인증을 인터페이스로 분리해 EC2/PostGIS로 옮겨도 핸들러 수정 불필요
