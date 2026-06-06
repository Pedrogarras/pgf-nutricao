package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	_ "modernc.org/sqlite"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	qrterminal "github.com/mdp/qrterminal/v3"
)

func main() {
	ctx := context.Background()
	logger := waLog.Stdout("Main", "INFO", true)

	db, err := sql.Open("sqlite", "file:session.db")
	if err != nil {
		logger.Errorf("Erro ao abrir banco: %v", err)
		os.Exit(1)
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		logger.Errorf("Erro ao ativar foreign keys: %v", err)
		os.Exit(1)
	}
	container := sqlstore.NewWithDB(db, "sqlite", waLog.Stdout("DB", "ERROR", true))
	if err = container.Upgrade(ctx); err != nil {
		logger.Errorf("Erro ao inicializar banco: %v", err)
		os.Exit(1)
	}

	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		logger.Errorf("Erro ao obter dispositivo: %v", err)
		os.Exit(1)
	}

	client := whatsmeow.NewClient(device, waLog.Stdout("WA", "INFO", true))
	client.AddEventHandler(func(evt interface{}) {
		handleEvent(client, evt)
	})

	if client.Store.ID == nil {
		// Primeira vez: escanear QR code
		qrChan, _ := client.GetQRChannel(ctx)
		err = client.Connect()
		if err != nil {
			logger.Errorf("Erro ao conectar: %v", err)
			os.Exit(1)
		}
		for evt := range qrChan {
			if evt.Event == "code" {
				fmt.Println("\n=== Escaneie o QR Code abaixo com o WhatsApp ===")
				qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
			} else {
				fmt.Printf("Login: %s\n", evt.Event)
			}
		}
	} else {
		// Já autenticado
		err = client.Connect()
		if err != nil {
			logger.Errorf("Erro ao conectar: %v", err)
			os.Exit(1)
		}
		fmt.Println("Conectado ao WhatsApp!")
	}

	// Aguarda sinal de encerramento (Ctrl+C)
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	fmt.Println("\nEncerrando...")
	client.Disconnect()
}

func handleEvent(client *whatsmeow.Client, evt interface{}) {
	switch v := evt.(type) {
	case *events.Message:
		printMessage(v)
		// Exemplo: responder automaticamente mensagens de texto simples
		// Descomente a linha abaixo para ativar resposta automática:
		// autoReply(client, v)
	case *events.Connected:
		fmt.Println("[SISTEMA] Conectado ao WhatsApp")
	case *events.Disconnected:
		fmt.Println("[SISTEMA] Desconectado")
	case *events.LoggedOut:
		fmt.Println("[SISTEMA] Sessão encerrada. Delete session.db e reconecte.")
		os.Exit(1)
	}
}

func printMessage(msg *events.Message) {
	info := msg.Info
	ts := info.Timestamp.Format("02/01 15:04")
	sender := info.Sender.User
	chat := info.Chat.User

	var text string
	if msg.Message.GetConversation() != "" {
		text = msg.Message.GetConversation()
	} else if msg.Message.GetExtendedTextMessage() != nil {
		text = msg.Message.GetExtendedTextMessage().GetText()
	} else if msg.Message.GetImageMessage() != nil {
		text = "[Imagem]"
	} else if msg.Message.GetVideoMessage() != nil {
		text = "[Vídeo]"
	} else if msg.Message.GetAudioMessage() != nil {
		text = "[Áudio]"
	} else if msg.Message.GetDocumentMessage() != nil {
		text = "[Documento]"
	} else {
		text = "[Mensagem não suportada]"
	}

	if info.IsGroup {
		fmt.Printf("[%s] Grupo %s | %s: %s\n", ts, chat, sender, text)
	} else {
		fmt.Printf("[%s] %s: %s\n", ts, sender, text)
	}
}

// autoReply envia uma resposta automática para mensagens de texto
func autoReply(client *whatsmeow.Client, msg *events.Message) {
	if msg.Info.IsFromMe {
		return
	}
	text := msg.Message.GetConversation()
	if text == "" {
		return
	}

	resposta := "Olá! Recebi sua mensagem: " + text
	_, err := client.SendMessage(context.Background(), msg.Info.Chat, &waProto.Message{
		Conversation: proto.String(resposta),
	})
	if err != nil {
		fmt.Printf("Erro ao enviar resposta: %v\n", err)
	}
}
