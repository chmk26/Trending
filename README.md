# GitHub Trending Dashboard

GitHub Trending의 **Repositories**만 카드 형태로 보여 주는 GitHub Pages용 정적 사이트입니다. 매일 GitHub Actions가 Daily / Weekly / Monthly 트렌딩을 수집하고, 날짜별 스냅샷을 저장합니다.

## 포함 기능

- 넓은 화면 3열 → 태블릿 2열 → 모바일 1열 반응형 카드
- Repository ID, Stars, Forks, 언어, 최근 트렌딩 증가 Star, 소유자, 업데이트 시각
- GitHub Open Graph 미리보기(없을 때 소유자 아바타로 대체)
- 원문 영어 설명과 한국어 번역을 한 카드에서 전환
- Daily / Weekly / Monthly 탭과 과거 스냅샷 선택
- 검색, 언어 필터, Stars / Forks / Trending 증가량 정렬
- 시스템 설정을 따르는 라이트/다크 모드 + 수동 전환 (브라우저에 기억)

## GitHub Pages 배포

1. 이 폴더의 내용을 새 GitHub 저장소에 올립니다. 저장소 이름은 예를 들어 `github-trending-dashboard`로 합니다.
2. GitHub 저장소의 **Settings → Pages → Build and deployment**에서 `Source: Deploy from a branch`, `Branch: main`, `/ (root)`를 선택합니다.
3. **Actions** 탭에서 `Update GitHub Trending snapshots` 워크플로를 열고 **Run workflow**를 한 번 누릅니다.
4. 몇 분 뒤 `https://<GitHub 사용자명>.github.io/<저장소명>/`에서 열립니다.

워크플로는 매일 09:20 KST(UTC 00:20)에 실행됩니다. `workflow_dispatch`도 있으므로 수동 갱신할 수 있습니다.

## 데이터와 번역

`data/current.json`은 가장 최근 수집본이고, `data/history/`에는 다음 규칙으로 저장됩니다.

```
data/history/daily/YYYY-MM-DD.json
data/history/weekly/YYYY-Www.json
data/history/monthly/YYYY-MM.json
```

설명 한국어 번역은 MyMemory 공개 번역 엔드포인트를 이용하며, 이전 번역은 `data/translations.json`에 캐시합니다. 공개 무료 엔드포인트에는 호출량 제한이 있으므로 대규모/상업적 운용에는 별도 번역 API로 `translateDescription()` 함수만 교체하는 편이 안전합니다. 번역 요청이 실패한 항목은 UI에 실패 상태가 표시되고 영어 원문은 항상 남습니다.

## 주의

- GitHub Trending은 공식 API가 없어서 공개 웹페이지 구조를 읽습니다. GitHub이 페이지 구조를 크게 바꾸면 `scripts/fetch-trending.mjs`의 `extractTrendingRepos()`를 조정해야 할 수 있습니다.
- GitHub Actions 기본 권한이 읽기라면, 저장소 **Settings → Actions → General → Workflow permissions**에서 `Read and write permissions`를 선택해야 수집 결과를 커밋할 수 있습니다.

## 로컬 확인

정적 파일이므로 이 폴더에서 간단한 서버로 열면 됩니다.

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`으로 접속합니다. 실데이터 생성은 GitHub Actions에서 수행됩니다.
