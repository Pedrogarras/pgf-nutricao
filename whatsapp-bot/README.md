# WhatsApp Bot (whatsmeow)

Leitor de mensagens do WhatsApp usando Go + whatsmeow.

## Pré-requisitos

- Go 1.21+
- GCC (necessário para go-sqlite3)
  - Windows: instale o [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) ou via `winget install tdm-gcc.tdm-gcc`

## Como rodar

```bash
cd whatsapp-bot

# Baixar dependências
go mod tidy

# Rodar o bot
go run .
```

Na primeira vez, um **QR Code** vai aparecer no terminal.
Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho → Escaneie o QR code.

## O que faz

- Conecta ao WhatsApp via QR code (sem precisar do número de telefone)
- Salva a sessão em `session.db` (não precisa escanear de novo)
- Exibe no terminal todas as mensagens recebidas:
  - Mensagens diretas
  - Mensagens de grupos
  - Imagens, vídeos, áudios e documentos (indicados por tipo)

## Resposta automática (opcional)

No `main.go`, descomente a linha `autoReply(client, v)` para ativar respostas automáticas.

## Estrutura dos logs

```
[DD/MM HH:MM] REMETENTE: mensagem          ← mensagem direta
[DD/MM HH:MM] Grupo NOME | REMETENTE: msg  ← mensagem de grupo
```
