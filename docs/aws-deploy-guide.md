# NowThere 실행·배포 가이드 (Windows 기준)

## 0. 준비물

- Node.js 22 LTS
- AWS CLI v2, 그리고 기존 AWS 계정
- 휴대폰에 **Expo Go** 앱 (개발 중 테스트용)

## 1. AWS 없이 먼저 로컬에서 돌려보기 (5분)

```powershell
cd backend
npm install
npm test            # 27개 테스트: 검증 규칙, EXIF 추출/제거, 지도 핀, API 흐름
# 휴대폰이 사진을 올릴 주소이므로 PC의 LAN IP로 지정 (ipconfig로 확인)
$env:PUBLIC_BASE_URL = "http://192.168.0.10:4000"
npm run dev         # 샘플 게시물 8개 포함
```

다른 터미널에서 앱 실행:

```powershell
cd app
npm install
# PowerShell의 echo > 는 UTF-16으로 저장되어 Expo가 못 읽으므로 ascii로 저장
Set-Content .env "EXPO_PUBLIC_API_URL=http://192.168.0.10:4000" -Encoding ascii
npx expo start
```

Cognito 설정이 없으면 앱은 **개발 모드 로그인**(닉네임만 입력)으로 동작합니다.
Windows 방화벽이 4000 포트를 막으면 허용해주세요.

## 2. AWS 자격 증명 설정 (최초 1회)

루트 계정 키는 쓰지 말고 IAM Identity Center(SSO) 사용자를 권장합니다.

```powershell
aws configure sso          # 리전: ap-northeast-2
aws sts get-caller-identity --profile <프로필>
$env:AWS_PROFILE = "<프로필>"
```

## 3. 배포

```powershell
cd infra
npm install
npx cdk bootstrap                                        # 계정·리전당 최초 1회
npm run deploy -- -c alertEmail=you@example.com -c budgetUsd=5
```

- 약 5~8분 소요 (CloudFront 생성이 가장 오래 걸림).
- 끝나면 `app/.env`가 자동으로 생성됩니다 (API URL, Cognito Client ID).
- Budgets 알림 이메일은 AWS가 보내는 구독 확인 메일을 수락해야 동작합니다.

확인:

```powershell
$api = (Get-Content cdk-outputs.json | ConvertFrom-Json).NowThere.ApiUrl
Invoke-RestMethod "$api/health"
```

## 4. 앱을 AWS 백엔드에 연결

```powershell
cd app
npx expo start --clear     # .env가 바뀌면 --clear 필요
```

앱에서 가입 → 이메일로 받은 6자리 코드 입력 → 지도에서 "지금 공유" → 카메라로 촬영 → 게시.
게시 후 몇 초 안에 서버 판정 결과(배지와 사유)가 표시됩니다.

**실제 기기 테스트가 꼭 필요한 부분**: 기기/OS마다 사진 파일에 EXIF가 남는지가 다릅니다.
파일에 EXIF가 없으면 서버는 앱이 보고한 촬영 시각을 쓰고 배지를 "근처 검증됨"으로 제한합니다.
CloudWatch Logs의 `MediaProcessorFn` 로그에서 `captureTimeSource`와 사유를 확인할 수 있습니다.

## 5. APK 빌드 (Android)

1. Google Cloud Console에서 **Maps SDK for Android** 키 발급 (모바일 SDK 지도 표시는 무료)
2. `app/app.json`의 `REPLACE_WITH_GOOGLE_MAPS_ANDROID_KEY_FOR_APK_BUILDS` 교체
3. `npm run build:apk` (기존 EAS 설정 그대로)

Expo Go에서는 키 없이도 지도가 나옵니다.

## 6. (선택) GitHub Actions로 자동 배포

`.github/workflows/ci.yml`은 테스트·synth만 합니다. 자동 배포를 붙이려면:

1. IAM에 GitHub OIDC 공급자(`token.actions.githubusercontent.com`)와 배포용 역할 생성
2. 워크플로에 `aws-actions/configure-aws-credentials`(role-to-assume) → `npx cdk deploy` 단계 추가

이 과정 자체가 "장기 액세스 키 없는 CI/CD" 경험으로 이력서에 쓰기 좋습니다.

## 7. 정리 / 비용 0으로 되돌리기

```powershell
cd infra
npx cdk destroy
```

DynamoDB 테이블, 미디어 버킷, Cognito 사용자 풀은 데이터 보호를 위해 `RETAIN`으로 설정되어 있어 남습니다.
완전히 지우려면 콘솔에서 직접 삭제하세요 (태그 `project=nowthere`로 찾을 수 있음).

## 8. 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| `cdk bootstrap` 권한 오류 | 배포 사용자에 AdministratorAccess(개인 계정) 또는 CDK 부트스트랩 권한 필요 |
| 번들링 시 Docker 요구 | `infra`에서 `npm install`로 esbuild가 설치되었는지 확인 |
| 앱에서 "서버에 연결할 수 없습니다" | `.env`의 URL 확인 후 `npx expo start --clear` |
| 업로드 후 계속 "검증 진행 중" | CloudWatch `MediaProcessorFn` 로그 확인 (JPEG가 아니면 rejected) |
| 이메일 인증 코드가 안 옴 | Cognito 기본 메일은 하루 50통 제한, 스팸함 확인 |
