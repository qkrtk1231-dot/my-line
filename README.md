# MY LINE 4.0 — 설치형 PWA

## 먼저 알아둘 점
- **Google 로그인/동기화는 Supabase 프로젝트 설정 전에는 작동하지 않습니다.** 이 ZIP만 열어서는 로그인되지 않습니다.
- **기존 3.0 기록은 다른 도메인(file:// ↔ GitHub Pages)으로 자동 이전되지 않습니다.** 반드시 3.0에서 **설정 → JSON 백업**을 내려받고, 4.0에서 **설정 → 복원**하세요.
- 클라우드 동기화가 꺼져 있어도 기존 localStorage 자동 저장은 작동합니다. 브라우저 데이터 삭제 시 기록이 사라질 수 있으니 JSON 백업을 보관하세요.
- 바코드 검색은 Open Food Facts 공개 API를 사용합니다. 검색 결과의 정확성과 국내 제품 수록률은 보장되지 않습니다.

## 1. GitHub Pages 게시
1. GitHub에서 새 저장소를 만들고 ZIP을 푼 파일들을 **저장소 최상위 폴더**에 업로드하세요 (`index.html`, `sync.js`, `config.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`).
2. Settings → Pages → Deploy from a branch → main / root를 선택하세요.
3. 배포된 `https://사용자명.github.io/저장소명/` 주소로 접속하세요. **HTTPS에서만** 서비스 워커와 카메라가 안정적으로 동작합니다.

## 2. Supabase 프로젝트 및 DB
1. https://supabase.com 에서 프로젝트 생성.
2. SQL Editor에서 `schema.sql` 내용을 실행하세요. 테이블 RLS가 활성화되어 있는지 확인하세요.
3. Project Settings → API에서 **Project URL**과 **anon / publishable key**를 확인하세요. `service_role` 또는 secret 키를 웹 파일에 넣으면 안 됩니다.
4. `config.js`의 두 빈 값을 채우고 GitHub에 다시 업로드하세요.

## 3. Google 로그인
1. Google Cloud Console에서 OAuth 동의 화면을 구성하고 OAuth 웹 클라이언트를 생성하세요.
2. Google OAuth 승인된 리디렉션 URI에 `https://<프로젝트>.supabase.co/auth/v1/callback`을 등록하세요.
3. Supabase → Authentication → Providers → Google에서 Client ID와 Secret을 입력하고 활성화하세요.
4. Supabase → Authentication → URL Configuration에서 Site URL 및 Redirect URLs에 GitHub Pages 배포 주소를 등록하세요. 저장소 하위 경로(`/저장소명/`)를 포함해야 합니다.
5. 앱 설정에서 Google 로그인 버튼을 누르고 로그인 후 다시 돌아오는지 확인하세요.

## 4. 3.0 데이터 안전 이전
1. 기존 3.0 HTML을 열어 **JSON 백업**을 다운로드하고 파일을 별도 보관합니다.
2. 4.0 GitHub Pages 주소를 열고 설정 → 백업 복원으로 JSON을 가져옵니다.
3. 체중·식단·영양제·레시피가 복원됐는지 확인합니다.
4. Google 로그인 후 **이 기기의 기록을 처음 클라우드에 저장**할지 묻는 확인창을 확인합니다.
5. 다른 기기에서 로그인 시 클라우드 기록을 불러옵니다.

## 5. 바코드
- 바코드 탭 → 카메라 스캔 또는 번호 직접 입력 → 검색 → 제품 영양정보 확인 → 식품 목록에 저장.
- 카메라 인식은 브라우저의 `BarcodeDetector` 지원 여부에 따라 다릅니다. 미지원 시 번호 입력으로 검색 가능합니다.
- 검색 데이터는 Open Food Facts 사용자 기여 자료이며, 포장지와 다르면 등록하지 마세요.

## 6. 동기화 안전 규칙
- 모든 기록은 먼저 기기에 저장되며 로그인 상태에서 2초 후 동기화를 시도합니다.
- 서버에는 사용자별 스냅샷 한 개가 저장되며, Supabase RLS로 타인 접근을 차단합니다.
- 서버 revision이 달라지면 자동 덮어쓰지 않고 중지합니다. 이 경우 현재 기록을 JSON 백업 후 클라우드 기록 불러오기를 선택하세요.
- **서로 다른 기기에서 동시에 편집한 변경 사항을 자동 병합하지는 않습니다.**
- Google 로그인 정보와 서비스 연동 설정은 사용자가 직접 설정해야 합니다.

## 7. 앱 설치
- Android Chrome: 브라우저 메뉴 → 홈 화면에 추가 / 앱 설치.
- iPhone Safari: 공유 → 홈 화면에 추가.
- 첫 온라인 접속 후 기본 앱 화면은 오프라인에서도 열 수 있습니다. 바코드 검색·로그인·동기화는 인터넷이 필요합니다.
