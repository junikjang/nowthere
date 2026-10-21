# NowThere App (Expo / React Native)

지도 핀, 인기·내 주변 피드, 촬영·업로드, Cognito 로그인이 실제 API에 연결된 앱입니다.

## 실행

```powershell
npm install
npx expo start          # 휴대폰의 Expo Go로 QR 스캔
```

API 주소와 Cognito 설정은 `app/.env`에서 읽습니다.
- AWS 배포 후: `infra`에서 `npm run deploy`를 실행하면 자동 생성
- 로컬 백엔드: `Set-Content .env "EXPO_PUBLIC_API_URL=http://<PC IP>:4000" -Encoding ascii`
  (Cognito 설정이 없으면 닉네임만 입력하는 개발 모드 로그인)

## APK 빌드

`app.json`의 Google Maps Android 키를 넣은 뒤 `npm run build:apk` (EAS).
`preview` 프로필은 APK, `production` 프로필은 AAB를 만듭니다.

자세한 내용: [../docs/aws-deploy-guide.md](../docs/aws-deploy-guide.md)
