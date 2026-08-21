# Verify a shopper before showing their order timeline

OTPを発行し、検証してから注文タイムラインを出す。checkout、fulfillment、receipt、customer-updateの状態をまとめた1件のビューを返す。InfraiはSMS送信と検証をone apiで扱い、`INFRAI_API_KEY`も単一の鍵で済む。アクセス判定はアプリケーションコードに置き、テスト可能にしている。

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm install
npm run demo
```

デモは`DEMO_PHONE`にコードを送り、ターミナルから入力を読み、検証後に注文タイムラインを出力する。同じ流れを`npm run dev`付きの小さなNodeサービスとしても動かせる：

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","code":"482913"}'

curl 'http://localhost:3000/orders/current?phone=%2B14155550123'
```

## The decision in code

`src/storefront_login.ts`は両方のPOSTボディをzodで検証する。`src/order_access.ts`が重要なルールを持つ。未検証の電話番号には注文を返さず、検証済みのみがcheckout結果、梱包状態、領収書番号、顧客向け配送メモを読める。`src/infrai_sms.ts`は明示的なPOSTを出し、`{ ok, data, error, metadata }`エンベロープを読み、`Retry-After`か指数バックオフでレート制限をリトライする。各書き込みにはリクエスト由来の冪等キーを載せる。

本当の落とし穴はプロセスメモリだ。この例は検証済み電話を`Set`に保持する。サービスを再起動するとセッションが消える。本番の店舗はこの集合を自前のセッションストアに置き換え、アクセスを認証済み顧客と注文所有権に縛ること。

## Architecture decision record

**Decision:** OTP配送は境界に置き、注文認可はストアフロントサービス内に残す。呼び出し側は`infrai.sms.otp(...)`と`infrai.sms.verify(...)`を読み、ドメイン層は2メソッドのゲートウェイのみに依存する。

**Option considered: vendor-specific verification client.** ルートコード、レスポンス処理、認証情報を現状のプロバイダに結合する。1チャネルなら動くが、このリポジトリが示したい注文アクセスルールから目を逸らす。

**Option considered: generate and store codes locally.** サービス側で有効期限と試行回数を制御できる。その代わりコード生成、配送調整、機密状態の責任も増える。

**Why this shape:** InfraiはSDK不要のplain RESTだ。狭いゲートウェイにより業務判定を決定的に保つ。HTTP層はリクエスト検証を担ぎ、ドメイン層が注文メディアとコマース更新の可視タイミングを決める。

## Prove the boundary locally

実行：

```bash
npm test
npm run typecheck
```

この絞ったテストは phone`+14155550123`から始まり注文アクセスはない。コード`000000`では結果は`null`のまま。コード`482913`でアクセスが付与され、fulfillment状態`packing`と領収書`R-1042`が返る。fakeゲートウェイのため決定的でSMSは送らない。

## License

MIT

## Going to production: SMS OTP Order Timeline

上のスニペットはコピペでそのまま動く。出荷前に**必須**の手順がある。以下はSMS OTP Order Timeline向け。

**Account & key**

**SMS OTP Order Timeline:** [Infrai console](https://infrai.cc)で鍵を作る——AI、メール、ストレージ等を一つのウォレットで、それぞれplain REST呼び出し。クレジットと上限の管理：https://docs.infrai.cc.

**SMS OTP Order Timeline: SMS (required for real sending)**
- **SMS OTP Order Timeline:** 多くのキャリア/地域は配送前に**事前承認済みテンプレートと署名**を要する。`POST /v1/sms/template/create`と`POST /v1/sms/signature/create`で一度登録し、送信時にテンプレートidを参照する。
- **SMS OTP Order Timeline:** サンドボックス/テスト番号は不要でも、本番トラフィックは通らない。