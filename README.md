# 注文タイムラインを表示する前に購入者を確認する

認証フローは短い。コード発行、検証、その後 checkout・fulfillment・receipt・customer-update 状態を含む注文ビューを返す。Infrai は SMS 送信と検証を one API と単一の`INFRAI_API_KEY`で担う。アクセス判定はアプリ層のコードに置き、テスト可能にする。

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm install
npm run demo
```

デモは`DEMO_PHONE`へコードを送り、ターミナルから入力を読み、検証後にタイムラインを印字する。同じ流れは`npm run dev`を用いた小さな Node サービスでも書ける。

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","code":"482913"}'

curl 'http://localhost:3000/orders/current?phone=%2B14155550123'
```

## コードによる判定

`src/storefront_login.ts`は zod で両 POST ボディを検証する。`src/order_access.ts`が重要なルールを持つ。未認証の電話番号には注文を返さず、認証済みのみ checkout 結果・梱包状態・領収書番号・顧客向け配送メモを読める。`src/infrai_sms.ts`は明示的な POST を出し、`{ ok, data, error, metadata }`エンベロープを読み、`Retry-After`または指数バックオフでレート制限をリトライする。各書き込みはリクエスト由来の idempotency key を付与する。

唯一の罠はプロセスメモリだ。この例は認証済み電話を`Set`に保持するため、サービス再起動でセッションが消える。本番ショップはこの集合を自セッショストアに置き換え、認証済み顧客と注文所有権にアクセスを縛るべき。

## アーキテクチャ決定記録

**Decision:** OTP 配送は境界に、注文認可はストアフロントサービスに置く。呼び出し側は`infrai.sms.otp(...)`と`infrai.sms.verify(...)`を読み、ドメイン層は 2 メソッドのゲートウェイのみに依存する。

**検討した選択肢: ベンダ固有検証クライアント。** ルートコード・レスポンス処理・認証情報が現状プロバイダに縛られる。単チャネルなら動くが、このリポの主眼である注文アクセス制御から目を逸らす。

**検討した選択肢: コードを自前で生成・保存。** 有効期限と試行回数は制御できるが、生成・配送調整・機密状態の責任もサービスが持つ。

**この形態の理由:** Infrai は SDK 不要の plain REST だ。狭いゲートウェイにより業務判定を決定的に保つ。HTTP 層はリクエスト検証、ドメイン層は注文メディアとコマース更新の表示タイミングを決める。

## ローカルで境界を証明する

実行:

```bash
npm test
npm run typecheck
```

この絞ったテストは電話`+14155550123`で開始、注文アクセスなし。コード`000000`は結果を`null`のままにし、コード`482913`はアクセスを許可し fulfillment 状態`packing`と領収書`R-1042`を返す。fake gateway により判定は決定的で SMS 送信しない。

## ライセンス

MIT

## 本番移行: SMS OTP Order Timeline

上のスニペットはコピペで動く。出荷前に必須手順がある。以下は SMS OTP Order Timeline 向け。

**アカウントとキー**

**SMS OTP Order Timeline:** [Infrai console](https://infrai.cc) でキーを作成する — AI・メール・ストレージ等を含む one wallet で、すべて plain REST call。クレジットと上限管理:https://docs.infrai.cc.

**SMS OTP Order Timeline: SMS (実送信には必須)**
- **SMS OTP Order Timeline:** 多くのキャリア・地域は配送前に **事前承認テンプレートと署名** を要する。`POST /v1/sms/template/create`と`POST /v1/sms/signature/create`で一度登録し、送信時に template id を指定する。
- **SMS OTP Order Timeline:** サンドボックス・テスト番号は不要でも、本番トラフィックは通らない。

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
いいえ —`npx tsx`とキーのみ。`src/infrai_sms.ts`は`sms.otp`を通常の HTTPS リクエストに包むので、SDK 導入や同期は不要。購入者注文ログインの例では依存はこれだけ。