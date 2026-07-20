# P3 — 94 version rows human-reviewed (APPLIED 2026-07-20)

Target: `research/context7-legality/programming-docs.db` table `programming_docs`. Backup: `programming-docs.db.p3bak`.

**Method.** For each of the 94 `needs_human=1` rows: took upstream truth from GitHub via `gh` (`release list --exclude-pre-releases`, `releases/latest`, `tags`), dropped every pre-release (`rc/canary/beta/alpha/-M#/.CR/__branch__/…`) and sibling-package/monorepo tags, reduced to the project's release line. `version_label` = context7's scrape-newest line (`site_versions` is_latest label; the 7 `latest` placeholders derived from the default snapshot's ref). `is_latest` = 1 iff that line == upstream newest **stable**, compared at the label's own granularity. `sha`/`repo_url` never touched.

**Policy calls (approved).** (1) Same-major rows where only a minor advanced (quarkus, axios, prettier, carbon, haystack, cluster-api) → `is_latest=0` (per-minor, honest). (2) The 16 REVIEW rows applied per recommendation; aiogram set to `3`/latest (newest *release* 3.30; v4.1 unreleased).

## Acceptance checks
- `SELECT COUNT(*) WHERE needs_human=1` → **0**.
- `sha`+`repo_url` vs `.p3bak` across all 94 touched idx: **0 differences** (md5 identical, `60da4f84b837008ad7a74217f533cb83`).
- Spot-check: next.js `16`/latest, typescript `6`/latest, huggingface/transformers `5`/latest, mui/material-ui `7`/not-latest — all current **stable**, no canary/rc.

## All 94 rows  (34 label changes, 35 is_latest changes)

`idx | project | old_label→new_label | old_is_latest→new_is_latest | upstream_newest_stable | class`

- `0` vercel/next.js | 16→**16** | 1→1 | 16.2.10 | AUTO
- `1` better-auth/better-auth | 1.6→**1.6** | 1→1 | 1.6.23 | AUTO
- `5` microsoft/playwright | 1.61→**1.61** | 1→1 | 1.61.1 | AUTO
- `8` vitest-dev/vitest | 4.1→**4.1** | 1→1 | 4.1.10 | AUTO
- `9` vitejs/vite | 8→**8** | 1→1 | 8.1.5 | AUTO
- `10` tanstack/query | 5→**5** | 1→1 | 5.90.3 | AUTO
- `13` spring-projects/spring-boot | 4→**4** | 1→1 | 4.1.0 | AUTO
- `16` payloadcms/payload | 3→**3** | 1→1 | 3.86.0 | AUTO
- `24` mui/base-ui | 1.6→**1.6** | 1→1 | 1.6.0 | AUTO
- `26` remix-run/react-router | 6→**7** | 0→0 | 8.2.0 | REVIEW
- `29` pydantic/pydantic-ai | 2→**2** | 1→1 | 2.13.0 | AUTO
- `33` colinhacks/zod | 4→**4** | 1→1 | 4.4.3 | AUTO
- `38` ant-design/ant-design | 6→**6** | 1→1 | 6.5.1 | AUTO
- `39` huggingface/transformers | 4→**5** | 0→1 | 5.14.1 | AUTO
- `43` microsoft/typescript | 4→**6** | 0→1 | 6.0.3 | AUTO
- `46` keycloak/keycloak | 26→**26** | 1→1 | 26.7.0 | AUTO
- `50` openai/openai-python | 2→**2** | 1→1 | 2.46.0 | AUTO
- `53` langchain-ai/langgraph | 1→**1** | 1→1 | 1.2.9 | AUTO
- `61` storybookjs/storybook | 10→**10** | 1→1 | 10.5.2 | AUTO
- `79` mui/material-ui | 4→**7** | 0→0 | 9.2.0 | REVIEW
- `84` pmndrs/zustand | 5→**5** | 1→1 | 5.0.14 | AUTO
- `95` filamentphp/filament | 5→**5** | 1→1 | 5.7.1 | AUTO
- `96` apache/airflow | 2→**3** | 0→1 | 3.3.0 | AUTO
- `103` expressjs/express | 5.2→**5.2** | 1→1 | 5.2.1 | AUTO
- `106` mantinedev/mantine | 9→**9** | 1→1 | 9.4.1 | AUTO
- `109` tradingview/lightweight-charts | 5.2→**5.2** | 1→1 | 5.2.0 | AUTO
- `120` spring-projects/spring-ai | 1.1→**1.1** | 1→0 | 2.0.0 | REVIEW
- `124` google/adk-python | 1.25→**1.25** | 1→0 | 2.5.0 | AUTO
- `128` spring-projects/spring-framework | 7→**7** | 1→1 | 7.0.8 | AUTO
- `129` angular/angular | 17→**20** | 0→0 | 22.0.7 | AUTO
- `141` quarkusio/quarkus | 3.31→**3.31** | 1→0 | 3.37.3 | AUTO
- `153` espressif/esp-idf | 5.5→**5.5** | 1→0 | 6.0.2 | AUTO
- `172` rails/rails | 8→**8** | 1→1 | 8.1.3 | AUTO
- `173` nuxt/ui | 4→**4** | 1→1 | 4.10.0 | AUTO
- `175` langchain4j/langchain4j | 1.11→**1.12** | 0→0 | 1.18.0 | AUTO
- `184` software-mansion/react-native-reanimated | latest→**4.1** | 1→0 | 4.5.2 | REVIEW
- `189` textualize/textual | 6→**6** | 1→0 | 8.2.8 | AUTO
- `197` axios/axios | 1.15→**1.15** | 1→0 | 1.18.1 | AUTO
- `216` bigskysoftware/htmx | 2→**2** | 1→1 | 2.0.10 | AUTO
- `226` saadeghi/daisyui | 5.0→**5.5** | 0→0 | 5.6.18 | AUTO
- `228` nuxt/nuxt | 4→**4** | 1→1 | 4.5.0 | AUTO
- `236` i18next/react-i18next | 11→**14** | 0→0 | 17.0.10 | AUTO
- `251` i18next/i18next | 26→**26** | 1→1 | 26.3.6 | AUTO
- `275` automattic/mongoose | 7→**9** | 0→1 | 9.7.4 | AUTO
- `277` vuetifyjs/vuetify | 1→**2** | 0→0 | 4.1.5 | REVIEW
- `298` dotnet/aspnetcore | 10→**10** | 1→1 | 10.0.10 | AUTO
- `300` ag-grid/ag-grid | 30→**33** | 0→0 | 36.0.1 | AUTO
- `318` flet-dev/flet | 0.84→**0.84** | 1→0 | 0.86.1 | AUTO
- `340` mrousavy/react-native-vision-camera | 4→**5** | 0→1 | 5.1.1 | AUTO
- `367` aiogram/aiogram | 3→**3** | 0→1 | 3.30.0 | REVIEW
- `383` zauberzeug/nicegui | 3→**3** | 1→1 | 3.14.0 | AUTO
- `411` dotnet/maui | latest→**10** | 1→1 | 10.0.80 | REVIEW
- `419` marmelab/react-admin | 3→**4** | 0→0 | 5.15.1 | AUTO
- `429` upstash/context7 | latest→**1** | 1→0 | 3.2.4 | REVIEW
- `443` prettier/prettier | 3.8→**3.8** | 1→0 | 3.9.5 | AUTO
- `453` dioxuslabs/dioxus | 0.7→**0.7** | 1→1 | 0.7.9 | AUTO
- `533` composiohq/composio | latest→**0.10** | 1→0 | 0.11.1 | REVIEW
- `573` zephyrproject-rtos/zephyr | 4.4→**4.4** | 1→1 | 4.4.1 | AUTO
- `591` spring-projects/spring-security | 6.5→**6.5** | 1→0 | 7.1.0 | AUTO
- `592` pocketbase/pocketbase | 0.35→**0.35** | 1→0 | 0.39.8 | AUTO
- `616` spring-projects/spring-batch | 6→**6** | 1→1 | 6.0.4 | AUTO
- `749` wagtail/wagtail | 6→**7** | 0→1 | 7.4.2 | AUTO
- `751` unfoldadmin/django-unfold | 0.76→**0.76** | 1→0 | 0.101.0 | AUTO
- `772` angular/components | 21→**21** | 1→0 | 22.0.5 | AUTO
- `780` python-websockets/websockets | 16→**16** | 1→1 | 16.1.1 | AUTO
- `796` carbon-design-system/carbon | 11.108→**11.108** | 1→0 | 11.112.0 | AUTO
- `902` deepset-ai/haystack | 2.28→**2.28** | 1→0 | 2.31.0 | AUTO
- `1033` jetbrains/exposed | 1.1→**1.3** | 0→1 | 1.3.1 | AUTO
- `1347` oai/openapi-specification | 3.0→**3.1** | 0→0 | 3.2.0 | AUTO
- `1359` labstack/echo | 4→**5** | 0→1 | 5.3.0 | AUTO
- `1707` helm/helm | 2→**4** | 0→1 | 4.2.3 | AUTO
- `1912` wasp-lang/wasp | 0.24→**0.24** | 1→1 | 0.24.0 | AUTO
- `1927` twbs/bootstrap | 2→**4** | 0→0 | 5.3.8 | REVIEW
- `2037` guzzle/guzzle | 3→**7** | 0→1 | 7.15.1 | AUTO
- `2057` fengyuanchen/cropperjs | 2→**2** | 1→1 | 2.1.1 | AUTO
- `2104` ziglang/zig | 0.15→**0.15** | 1→1 | 0.15.2 | AUTO
- `2121` tortoise/tortoise-orm | latest→**1** | 1→1 | 1.1.7 | REVIEW
- `2134` sylius/sylius | 1.11→**1.14** | 0→0 | 2.2.6 | REVIEW
- `2224` microsoft/vscode | 1.117→**1.117** | 1→0 | 1.129.1 | AUTO
- `2665` anza-xyz/kit | 2→**5** | 0→0 | 7.0.0 | REVIEW
- `2886` lodev09/react-native-true-sheet | 3→**3** | 1→1 | 3.11.9 | AUTO
- `3333` nvidia/cuda-python | latest→**13** | 1→1 | 13.3.1 | REVIEW
- `3695` ansys/pyaedt | 0.18→**0.25** | 0→0 | 1.3.0 | AUTO
- `5930` fedify-dev/fedify | 2→**2** | 1→1 | 2.3.3 | AUTO
- `6111` cosmos/cosmos-sdk | 0.53→**0.53** | 1→0 | 0.54.3 | AUTO
- `6173` cbournhonesque/lightyear | 0.25→**0.25** | 1→0 | 0.28.0 | AUTO
- `6226` bitcoin/bitcoin | 30→**30** | 1→0 | 31.1 | AUTO
- `7146` sulu/sulu | latest→**3.0** | 1→1 | 3.0.8 | REVIEW
- `7515` samber/lo | 1.53→**1.53** | 1→1 | 1.53.0 | AUTO
- `8987` kubernetes-sigs/cluster-api | 1.11→**1.11** | 1→0 | 1.13.4 | AUTO
- `10035` ethers-io/ethers.js | 5.7→**5.8** | 0→0 | 6.17.0 | REVIEW
- `15783` thudm/slime | 0.2→**0.2** | 1→0 | 0.3.0 | AUTO
- `31366` lahaluhem/text_sight | 0.0→**0.1** | 0→1 | 0.1.1 | AUTO
- `48361` anaconda/anaconda-ai | 0.7→**0.7** | 1→1 | 0.7.0 | AUTO
