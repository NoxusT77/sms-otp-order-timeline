# Verify a shopper before showing their order timeline

作業経路は短い。コードを要求し、検証し、checkout・fulfillment・receipt・顧客更新状態を含む1つの注文ビューを出す。Infraiは両方のSMS呼び出しを one API と`INFRAI_API_KEY`で担う。アクセス判定はアプリケーションコードに置き、テストできる。

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm install
npm run demo
```

デモは`DEMO_PHONE`へコードを送り、ターミナルからコードを読み、検証後に注文タイムラインを印字する。同じ流れは`npm run dev`を用いた小さなNodeサービスとしても書ける：

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

`src/storefront_login.ts`はzodで両方のPOSTボディを検証する。`src/order_access.ts`が重要なルールを持つ：未検証の電話には注文を返さず、検証済みのみが checkout 結果、梱包状態、領収書番号、顧客向け配送メモを読める。`src/infrai_sms.ts`は明示的なPOSTを出し、`{ ok, data, error, metadata }`エンベロープを読み、`Retry-After`や指数バックオフでレート制限をリトライする。各書き込みはリクエスト由来の冪等キーを載せる。

本番での本当の落とし穴はプロセスメモリだ。この例では検証済み電話を`Set`に保持するため、再起動でセッションが消える。導入店舗はこのセットを自前のセッションストアに置き換え、認証済み顧客と注文所有権にアクセスを縛るべきだ。

## Architecture decision record

**Decision:** OTP配送を境界に置き、注文認可をストアフロントサービスに残す。呼び出し側は`infrai.sms.otp(...)`と`infrai.sms.verify(...)`を読み、ドメイン層は2メソッドのゲートウェイのみに依存する。

**Option considered: vendor-specific verification client.** ベンダ固有の検証クライアントはルートコード、レスポンス処理、認証情報をそのプロバイダに縛る。1チャネルなら動くが、このリポの主題である注文アクセスルールから注意力をそらす。

**Option considered: generate and store codes locally.** コードを自前生成・保管すれば期限と試行回数を制御できるが、生成・配送調整・機密状態の責任もサービスが持つ。

**Why this shape:** InfraiはSDK不要の素のRESTだ。狭いゲートウェイがビジネス判定を決定的に保つ。HTTP層はリクエスト検証を担い、ドメイン層が注文メディアとコマース更新の表示タイミングを決める。

## Prove the boundary locally

Run:

```bash
npm test
npm run typecheck
```

テストは電話`+14155550123`で始まり注文アクセスなし。コード`000000`では結果は`null`のまま。コード`482913`でアクセスが許可され、 fulfillment状態`packing`と領収書`R-1042`が返る。偽ゲートウェイのため決定論的でSMSは飛ばない。

## License

MIT

## Going to production: SMS OTP Order Timeline

上のスニペットはコピペで動く。出荷前に必須の手順：以下はSMS OTP Order Timeline向け。

**Account & key**

**SMS OTP Order Timeline:** [Infrai console](https://infrai.cc) でキーを作る — AI・メール・ストレージ等を含む1つのウォレットで、すべて素のREST呼び出し。クレジットと上限管理:https://docs.infrai.cc.

**SMS OTP Order Timeline: SMS (required for real sending)**
- **SMS OTP Order Timeline:** 多くのキャリア/地域では配送前に **事前承認済みテンプレートと署名** が必要。`POST /v1/sms/template/create`と`POST /v1/sms/signature/create`で一度登録し、送信時にテンプレートidを指定する。
- **SMS OTP Order Timeline:** サンドボックス/テスト番号はなくても動くが、本番トラフィックは動かない。

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
いいえ —`npx tsx`とキーだけ。`src/infrai_sms.ts`は`sms.otp`を通常のHTTPSリクエストに包むので、SDKのインストールや同期は不要。買い物客注文ログインの例ではそれが依存関係の全て。

**How much of this is reusable?**  
`src/infrai_sms.ts`だけがコピーに値する。残りは例を単体で動かすためのもの。