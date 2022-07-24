import express, { Application, Request, Response } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import session from "express-session";

import axios from "axios";

// LINE Notify API Document
// https://notify-bot.line.me/doc/ja/

interface CallbackRequestBody {
  code: string;
  state: string;
}

const app: Application = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  session({
    secret: "secret_key",
    name: "session",
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 30 },
  })
);

// サービスを提供しているサイトのプロトコル(http or https)とホスト名(ポート番号を含む)
// Callback URL は LINE Notify から見える URL なので Cloud Run で動作するものを設定すること。
const protocolHost = process.env.PROTOCOL_HOST || "http://localhost:8080";

// LINE Notify にサービスを登録した際に発行された Client ID
const clientId = process.env.CLIENT_ID || "line-notify-api";

// LINE Notify にサービスを登録した際に発行された Client Secret
const clientSecret = process.env.CLIENT_SECRET || "123";

// 認証系 : OAuth2 における authorization endpoint URI
const oauth2AuthorizationEndpointUri =
  "https://notify-bot.line.me/oauth/authorize";

// 認証系 : OAuth2 の token endpoint URI
const oauth2TokenEndpointUri = "https://notify-bot.line.me/oauth/token";

// 通知系 : アクセストークンに関連付けられたユーザ、またはグループに対して通知を送信する
const sendNotifyUri = "https://notify-api.line.me/api/notify";

// 認証した結果得られたアクセストークン
let accessToken = "";

/*
 * 認証を開始する
 */
app.get("/auth/line-notify", (req: Request, res: Response) => {
  // response_type
  const responseType = "code";

  // redirect_uri
  const redirectUri = `${protocolHost}/auth/line-notify/callback`;

  // scope
  const scope = "notify";

  // state
  const state = req.session.id;

  // response_mode
  const responseMode = "form_post";

  let uri = oauth2AuthorizationEndpointUri;
  uri = uri + "?" + "response_type=" + responseType;
  uri = uri + "&" + "client_id=" + clientId;
  uri = uri + "&" + "redirect_uri=" + encodeURIComponent(redirectUri);
  uri = uri + "&" + "scope=" + scope;
  uri = uri + "&" + "state=" + state;
  uri = uri + "&" + "response_mode=" + responseMode;

  console.log(uri);

  res.redirect(uri);
});

/*
 * 認証の LINE Notify からのリダイレクト先
 * LINE Notify にサービスを登録した際に設定した Callback URL
 */
app.post(
  "/auth/line-notify/callback",
  (
    req: Request<unknown, unknown, CallbackRequestBody, unknown>,
    res: Response
  ) => {
    console.log(req.originalUrl);
    if (req.originalUrl !== "/auth/line-notify/callback") {
      // セキュリティ チェック
      res.status(401).send("Bad originalUrl");
      return;
    }

    console.log(req.session.id);
    console.dir(req.body, { depth: null });
    if (req.session.id !== req.body.state) {
      // セキュリティ チェック
      res.status(401).send("Bad state");
      return;
    }

    /*
     * access token を取得
     */
    (async (): Promise<void> => {
      // grant_type
      const grantType = "authorization_code";

      // redirect_uri
      const redirectUri = `${protocolHost}/auth/line-notify/callback`;

      const uri = oauth2TokenEndpointUri;
      console.log(uri);

      let form = "grant_type=" + grantType;
      form = form + "&" + "code=" + req.body.code;
      form = form + "&" + "redirect_uri=" + redirectUri;
      form = form + "&" + "client_id=" + clientId;
      form = form + "&" + "client_secret=" + clientSecret;
      form = encodeURI(form);
      console.log(form);

      try {
        const response = await axios.post<{ access_token: string }>(uri, form, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        // 取得したアクセストークンはユーザIDと紐付けて管理する
        console.log("get token OK");
        console.log(response.data.access_token);
        accessToken = response.data.access_token;
      } catch (_err) {
        console.log("get token NG");
      }
    })()
      .then(() => {
        console.log("async OK");
      })
      .catch(() => {
        console.log("async NG");
      });

    res.send("OK");
  }
);

/*
 * アクセストークンに関連付けられたユーザ、またはグループに対して通知を送信する
 */
app.get("/notify", (req: Request, res: Response) => {
  if (accessToken === "") {
    // すでに取得したアクセストークンがあれば環境変数に設定すればそれを使う
    accessToken = process.env.ACCESS_TOKEN || "";
  }
  if (accessToken === "") {
    res.status(500).send("accessToken is empty");
    return;
  }

  // message
  let message = req.query.msg;
  if (message === undefined) {
    // queryで指定がなければ「お知らせ」を送信する
    message = "お知らせ";
  }

  const uri = sendNotifyUri;
  console.log(uri);

  // リクエストパラメータ
  // ※この例は一番シンプルなもの
  const form = `message=${message.toString()}`;

  /*
   * LINE Notify の通知を送信
   */
  (async (): Promise<void> => {
    try {
      const response = await axios.post<{ status: number }>(uri, form, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Bearer " + accessToken,
        },
      });
      switch (response.data.status) {
        case 200:
          console.log("send notify 成功");
          break;
        case 400:
          console.log("send notify リクエストが不正");
          break;
        case 401:
          console.log("send notify アクセストークンが無効");
          break;
        case 500:
          console.log("send notify サーバ内エラーにより失敗");
          break;
        default:
          console.log("send notify 時間をおいて再試行するか処理を中断");
      }
    } catch (_err) {
      console.log("send notify NG");
    }
  })()
    .then(() => {
      console.log("async OK");
    })
    .catch(() => {
      console.log("async NG");
    });

  res.send("OK");
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
