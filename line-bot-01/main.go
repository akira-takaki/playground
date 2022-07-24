package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/line/line-bot-sdk-go/v7/linebot"
)

func main() {

	// チャネルアクセストークン
	// https://developers.line.biz/ja/docs/messaging-api/channel-access-tokens/
	bot, err := linebot.New(
		os.Getenv("CHANNEL_SECRET"),
		os.Getenv("CHANNEL_TOKEN"),
	)
	if err != nil {
		log.Fatal(err)
	}

	/*
	 * LINEプラットフォームからメッセージ(Webhook)を受信する
	 * 受信後、応答メッセージを送信する
	 * https://developers.line.biz/ja/docs/messaging-api/receiving-messages/
	 */
	http.HandleFunc("/callback", func(w http.ResponseWriter, req *http.Request) {
		// LINE bot : メッセージ受信
		events, err := bot.ParseRequest(req)
		if err != nil {
			if err == linebot.ErrInvalidSignature {
				// 署名を検証した結果、不正だった
				w.WriteHeader(400)
			} else {
				w.WriteHeader(500)
			}
			return
		}

		for _, event := range events {
			if event.Type == linebot.EventTypeMessage {
				switch message := event.Message.(type) {
				case *linebot.TextMessage:
					if _, err = bot.ReplyMessage(event.ReplyToken, linebot.NewTextMessage(message.Text)).Do(); err != nil {
						log.Print(err)
					}
				case *linebot.StickerMessage:
					replyMessage := fmt.Sprintf(
						"sticker id is %s, stickerResourceType is %s", message.StickerID, message.StickerResourceType)
					if _, err = bot.ReplyMessage(event.ReplyToken, linebot.NewTextMessage(replyMessage)).Do(); err != nil {
						log.Print(err)
					}
				}
			}
		}
	})

	/*
	 * 環境変数 USER_ID で指定されたユーザへ プッシュメッセージ を送信する
	 * https://developers.line.biz/ja/docs/messaging-api/sending-messages/#methods-of-sending-message
	 */
	http.HandleFunc("/sendLineMessage", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != "POST" {
			log.Print("POST method is required")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		length, err := strconv.Atoi(req.Header.Get("Content-Length"))
		if err != nil {
			log.Print("Error : Get Content-Length")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// body 取り出し
		body := make([]byte, length)
		length, err = req.Body.Read(body)
		if err != nil && err != io.EOF {
			log.Print("Error : Get body")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		log.Print("body=" + string(body))

		userId := os.Getenv("USER_ID")
		if userId != "" {
			log.Print("userId=" + userId)
			message := string(body)
			if _, err := bot.PushMessage(userId, linebot.NewTextMessage(message)).Do(); err != nil {
				log.Print(err)
			}
		} else {
			log.Print("userId is empty")
		}
	})

	if err := http.ListenAndServe(":"+os.Getenv("PORT"), nil); err != nil {
		log.Fatal(err)
	}
}
