require("./listmenu.js");
const chalk = require("chalk");
const fs = require("fs");
const fetch = require("node-fetch");
const QRCode = require("qrcode");
const Yts = require("yt-search");
const path = require('path');
const util = require("util");
const FileType = require("file-type");
const axios = require("axios");
const crypto = require("crypto");
const translate = require("translate-google-api");
const os = require('os');
const { exec, spawn, execSync } = require('child_process');
const fakeQuoted = require("./lib/fakequoted.js")
const { prepareWAMessageMedia, generateWAMessageFromContent, downloadContentFromMessage } = require("@whiskeysockets/baileys");

const vpsImages = {
  "ubuntu-22": { image: "ubuntu-22-04-x64", name: "Ubuntu 22.04 LTS" },
  "ubuntu-20": { image: "ubuntu-20-04-x64", name: "Ubuntu 20.04 LTS" },
  "debian-11": { image: "debian-11-x64", name: "Debian 11" },
  "centos-8": { image: "centos-8-x64", name: "CentOS 8" }
};

const vpsRegions = {
  "sgp": { code: "sgp1", name: "Singapore" },
  "blr": { code: "blr1", name: "Bangalore, India" },
  "fra": { code: "fra1", name: "Frankfurt, Germany" },
  "nyc": { code: "nyc1", name: "New York, USA" },
  "lon": { code: "lon1", name: "London, UK" },
  "sfo": { code: "sfo3", name: "San Francisco, USA" }
};

async function createVPSDroplet(apiKey, hostname, spec, os, region, password) {
  if (!settingVps[spec]) throw new Error(`Spec "${spec}" tidak valid.`);
  if (!vpsImages[os]) throw new Error(`OS "${os}" tidak valid.`);
  if (!vpsRegions[region]) throw new Error(`Region "${region}" tidak valid.`);
  
  const dropletData = {
    name: hostname.toLowerCase().trim().substring(0, 63),
    region: vpsRegions[region].code,
    size: settingVps[spec].size,
    image: vpsImages[os].image,
    ssh_keys: [],
    backups: false,
    ipv6: true,
    monitoring: true,
    tags: ["autoorder-vps", "telegram-bot", `user-${hostname}`, new Date().toISOString().split("T")[0]],
    user_data: `#cloud-config\npassword: ${password}\nchpasswd: { expire: false }\nssh_pwauth: true`
  };

  try {
    const response = await fetch("https://api.digitalocean.com/v2/droplets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "AutoOrder-Bot/1.0"
      },
      body: JSON.stringify(dropletData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      let errorMsg = data.message || `HTTP ${response.status}: ${response.statusText}`;
      if (data.id === "forbidden") errorMsg = "API Key tidak valid atau expired";
      else if (data.id === "unprocessable_entity") errorMsg = `Invalid request: ${data.message}`;
      else if (response.status === 429) errorMsg = "Rate limit exceeded, coba lagi nanti";
      throw new Error(errorMsg);
    }
    
    if (!data.droplet || !data.droplet.id) {
      throw new Error("Invalid response format from Digital Ocean API");
    }
    
    return data.droplet.id;
  } catch (error) {
    console.error("Create VPS Droplet Error:", error);
    throw new Error(`Gagal membuat VPS: ${error.message}`);
  }
}

async function getDropletIP(apiKey, dropletId) {
  try {
    const response = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "AutoOrder-Bot/1.0"
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.droplet) throw new Error("Droplet not found");
    
    if (data.droplet.status === 'new') return null;
    
    if (data.droplet.networks && data.droplet.networks.v4) {
      const publicIP = data.droplet.networks.v4.find(net => net.type === "public");
      return publicIP ? publicIP.ip_address : null;
    }
    
    return null;
  } catch (error) {
    console.error("Get Droplet IP Error:", error);
    return null;
  }
}

async function waitForDropletIP(apiKey, dropletId, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);
    const ip = await getDropletIP(apiKey, dropletId);
    if (ip) return ip;
  }
  return null;
}

async function generateStrongPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

//==================================//

async function Skyzopedia(m, sock) {
await global.loadDatabase(sock, m);
try {
const isCmd = m?.body?.startsWith(m.prefix)
const quoted = m.quoted ? m.quoted : m
const mime = quoted?.msg?.mimetype || quoted?.mimetype || null
const args = m?.body?.trim().split(/ +/).slice(1)
const qmsg = (m.quoted || m)
const text = q = args.join(" ")
const prefix = m.prefix
const command = isCmd ? m.body.slice(m.prefix.length).trim().split(' ').shift().toLowerCase() : ''
const cmd = m.prefix + command
const botNumber = m.botNumber
const isOwner = m.isOwner
  m.isGroup = m.chat.endsWith('g.us');
  m.metadata = {};
  m.isAdmin = false;
  m.isBotAdmin = false;
  if (m.isGroup) {
    let meta = await global.groupMetadataCache.get(m.chat)
    if (!meta) meta = await sock.groupMetadata(m.chat).catch(_ => {})
    m.metadata = meta;
    const p = meta?.participants || [];
    m.isAdmin = p?.some(i => (i.id === m.sender || i.jid === m.sender) && i.admin !== null);
    m.isBotAdmin = p?.some(i => (i.id === botNumber || i.jid == botNumber) && i.admin !== null);
  } 
  
const Reply = reply = async (teks, mentions = [m.sender]) => {
await sock.sendMessage(m.chat, { text: teks, contextInfo: {
mentionedJid: mentions, 
externalAdReply: {
thumbnailUrl: global.thumbnailReply, 
title: `${global.botname} - ${global.versibot}`, 
body: `Created by: ${global.ownername}.`, 
previewType: "PHOTO", 
mediaUrl: global.thumbnailReply, 
mediaType: 1, 
sourceUrl: ""              
}
}}, { quoted: m })
}


//==================================//

if (isCmd) {
console.log(chalk.white("• Sender  :"), chalk.blue(m.chat) + "\n" + chalk.white("• Group :"), chalk.blue(m.isGroup ? m.metadata.subject : "false") + "\n" + chalk.white("• Command :"), chalk.blue(cmd) + "\n")
}

//==================================//

if (isCmd && db.settings.modesewa && !isOwner && !command.includes("owner")) {
    if (m.isGroup) {
        if (!db.groups[m.chat] || !db.groups[m.chat].sewa) {
            return Reply(`⚠️ *Akses Ditolak*\nGrup ini tidak memiliki akses sewa bot.\nSilahkan hubungi owner untuk membeli sewa.`);
        }
        if (db.groups[m.chat].sewaTime && Date.now() >= db.groups[m.chat].sewaTime) {
            return Reply(`⚠️ *Sewa grup ini sudah expired.*`);
        }
    }
    return Reply(`⚠️ *Akses Ditolak*\nChat ini tidak memiliki akses sewa bot.\nSilahkan hubungi owner untuk membeli sewa.`);
}

//==================================//

if (m.isGroup && db.users[m.sender]?.afk?.status) {
    let data = db.users[m.sender].afk
    let dur = Date.now() - data.afkTime
    let reason = db.users[m.sender].afk.reason
    db.users[m.sender].afk = {
        status: false,
        reason: "",
        afkTime: 0
    }
    await Reply(`@${m.sender.split("@")[0]} kembali dari AFK setelah _${clockString(dur)}_\n*Alasan AFK:* ${reason}`)
}

if (m.isGroup && db.groups[m.chat]?.antilink) {
    try {
    const textMessage = m.body || ""
    const groupInviteLinkRegex = /(https?:\/\/)?(www\.)?chat\.whatsapp\.com\/[A-Za-z0-9]+(\?[^\s]*)?/gi
    const links = textMessage.match(groupInviteLinkRegex)
    if (links && !isOwner && !m.isAdmin && m.isBotAdmin) {
        const messageId = m.key.id
        const participantToDelete = m.key.participant || m.sender
        await sock.sendMessage(m.chat, {
            delete: {
                remoteJid: m.chat,
                fromMe: false,
                id: messageId,
                participant: participantToDelete
            }
        })
    }
    } catch (er) {}
}

//==================================//

if (db.settings.list && db.settings.list[m?.text?.toLowerCase()]) {
    const data = db.settings.list[m.body.toLowerCase()]
    const respon = data.response || ""
    if (data.image) {
        return sock.sendMessage(m.chat, { 
            image: { url: data.image }, 
            caption: respon 
        }, { quoted: m })
    } else {
        return m.reply(respon)
    }
}

//==================================//

if (m.isGroup && db.settings.pconly && !isOwner) return
if (!m.isGroup && db.settings.grouponly && !isOwner) return

//==================================//

const useLimit = (user = m.sender, jumlah = 1) => {
if (db.users[user].limit !== 0) {
return db.users[user].limit -= jumlah
}
}

const cekLimit = (user = m.sender, jumlah = 1) => {
let status = true
if (db.users[user].limit < 1) status = false
return status
}

if (!isCmd && sock[m.chat] && sock[m.chat].ttt && sock[m.chat].ttt.idGame) {
    let room = sock[m.chat].ttt;
    let game = room.game;

    const mapIcon = board => board.map((v, i) => {
        if (v === "X") return "❌";
        if (v === "O") return "⭕";
        return {
            0: "1️⃣", 1: "2️⃣", 2: "3️⃣",
            3: "4️⃣", 4: "5️⃣", 5: "6️⃣",
            6: "7️⃣", 7: "8️⃣", 8: "9️⃣"
        }[i];
    });

    // Surrender
    if (m.text.toLowerCase() === "surrender") {
        let winner = m.sender === room.playerX ? room.playerO : room.playerX;
        db.users[winner].balance += room.hadiah;
        clearTimeout(room.gameTime);

        sock.sendMessage(m.chat, {
            text: `
🎮 *Game TIC TAC TOE*
*@${m.sender.split("@")[0]} menyerah!*
🎉 Pemenang: @${winner.split("@")[0]}
+${room.hadiah} Balance 💸
            `.trim(),
            contextInfo: { mentionedJid: [m.sender, winner] }
        }, { quoted: m });

        delete sock[m.chat].ttt;
        return;
    }

    let pos = Number(m.text) - 1;
    if (isNaN(pos) || pos < 0 || pos > 8) return;

    let player = m.sender === room.playerX ? 0 :
                 m.sender === room.playerO ? 1 : null;
    if (player === null) return;
    if (game.currentTurn !== m.sender) return;

    let turn = game.turn(player, pos);
    if (turn <= 0) return;

    let papan = mapIcon(game.render());

    // Winner
    if (game.winner) {
        db.users[m.sender].balance += room.hadiah;
        clearTimeout(room.gameTime);

        sock.sendMessage(m.chat, {
            text: `
🎮 *Game TIC TAC TOE*
*Selamat @${m.sender.split("@")[0]} Menang* 🎉
+${room.hadiah} Balance untuk @${m.sender.split("@")[0]}
Game dihentikan.

${papan.slice(0,3).join("")}
${papan.slice(3,6).join("")}
${papan.slice(6,9).join("")}
            `.trim(),
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: m });

        delete sock[m.chat].ttt;
        useLimit();
        return;
    }

    // Draw
    if (game.boardFull()) {
        clearTimeout(room.gameTime);

        sock.sendMessage(m.chat, {
            text: `
🎮 *Game TIC TAC TOE*
*Game Seri / DRAW*
Game dihentikan.

${papan.slice(0,3).join("")}
${papan.slice(3,6).join("")}
${papan.slice(6,9).join("")}
            `.trim()
        }, { quoted: m });

        delete sock[m.chat].ttt;
        return;
    }

    sock.sendMessage(m.chat, {
        text: `
🎮 *Game TIC TAC TOE*
@${room.playerX.split("@")[0]} (❌) vs @${room.playerO.split("@")[0]} (⭕)
Giliran: @${game.currentTurn.split("@")[0]}

${papan.slice(0,3).join("")}
${papan.slice(3,6).join("")}
${papan.slice(6,9).join("")}

*⏰ Waktu:* 3 Menit
*🎁 Hadiah:* $${room.hadiah} Balance
        `.trim(),
        contextInfo: { mentionedJid: [room.playerX, room.playerO] }
    }, { quoted: m });
    useLimit();
}


if (!isCmd && sock[m.chat] && sock[m.chat].tebakboom && sock[m.chat].tebakboom.idGame) {
    const room = sock[m.chat].tebakboom;
    let num = Number(m.body) - 1;

    if (isNaN(num)) return;
    if (num < 0 || num >= room.gameQuestion.length) return;

    const renderBoom = arr =>
        arr.map((e, i) => (i === 2 || i === 5 ? e + "\n" : e)).join("");

    // KETEMU BOM
    if (room.boomIndex === num) {
        room.gameQuestion[num] = "💣";

        let teks = `
*DUARRRRR 💣*

${renderBoom(room.gameQuestion)}

@${m.sender.split("@")[0]} telah membuka kotak yang berisi boom!
*Game telah dihentikan.*
        `.trim();

        clearTimeout(room.gameTime);
        delete sock[m.chat].tebakboom;

        await sock.sendMessage(
            m.chat,
            {
                text: teks,
                mentions: [m.sender],
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        );

        delete sock[m.chat];
        useLimit();
        return;
    }

    if (room.gameQuestion[num] === "✅") return;

    room.gameQuestion[num] = "✅";
    const hadiah = room.hadiah;
    db.users[m.sender].balance += Number(hadiah);

    const semuaAmanTerbuka = room.gameQuestion.every((e, i) =>
        i === room.boomIndex ? true : e === "✅"
    );

    if (semuaAmanTerbuka) {
        let board = [...room.gameQuestion];
        board[room.boomIndex] = "💣";

        let teks = `
*🎉 SELAMAT! Semua kotak aman berhasil dibuka!*

${renderBoom(board)}

*Bom tidak terbuka — Game selesai otomatis.*
Total hadiah tetap masuk ke balance Anda.
        `.trim();

        clearTimeout(room.gameTime);
        useLimit();
        delete sock[m.chat].tebakboom;

        return await sock.sendMessage(
            m.chat,
            {
                text: teks,
                mentions: [m.sender],
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        );
    }

    let teks = `
*🎮 Game Tebak Boom 🎮*

@${m.sender.split("@")[0]} +$${hadiah}

${renderBoom(room.gameQuestion)}

*⏰ Waktu Game:* 5 Menit
*🎁 Hadiah per kotak:* $${hadiah}
    `.trim();

    await sock.sendMessage(
        m.chat,
        {
            text: teks,
            contextInfo: {
                mentionedJid: [m.sender],
                isForwarded: true,
                forwardingScore: 9999
            }
        },
        { quoted: m }
    );

    useLimit();
}


if (
    !isCmd &&
    m.body.length > 1 &&
    sock[m.chat] &&
    sock[m.chat].tebakhero &&
    sock[m.chat].tebakhero.idGame
) {
    const room = sock[m.chat].tebakhero

    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {

        const hadiahBaru = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah
        
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        
        const res = await fetchJson('https://api.serverweb.qzz.io/random/heroml?apikey=skyy')
        const audioHero = res.audio
        const jawaban = res.hero

        clearTimeout(room.gameTime)
        delete sock[m.chat].tebakhero

        let msgg 
        try {
        msgg = await sock.sendMessage(
            m.chat,
            {
                audio: { url: audioHero },
                mimetype: "audio/mpeg", 
                ptt: false, 
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999, 
                    externalAdReply: {
                    thumbnailUrl: "https://img1.pixhost.to/images/11906/688635364_image.jpg", 
                    title: "🎮 Hero Berikutnya 🎮", 
                    body: `🎁 +$${hadiahBaru} (Waktu 3 menit)`, 
                    previewType: "PHOTO"
                    }
                }
            },
            { quoted: m }
        )
        useLimit()
        } catch (err) {
        return m.reply("Error terjadi kesalahan saat mengambil gambar soal.")
        }

        const idGame = getRandom("")
        sock[m.chat] = {}
        sock[m.chat].tebakhero = {
            gameAnswer: jawaban,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.tebakhero
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${rm.gameAnswer}
                            `.trim()
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }

        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Tebak Hero*\n* ${sock[m.chat].tebakhero.gameAnswer}`
            },
            { quoted: sock[m.chat].tebakhero.gameMessage }
        )
    }
}

if (
    !isCmd &&
    m.body.length > 1 &&
    sock[m.chat] &&
    sock[m.chat].tebakgambar &&
    sock[m.chat].tebakgambar.idGame
) {
    const gameQuestions = require("./database/game/tebakgambar.js")
    const room = sock[m.chat].tebakgambar

    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {

        const { img, jawaban, deskripsi } =
            gameQuestions[Math.floor(Math.random() * gameQuestions.length)]

        const hadiahBaru = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah

        let teks = `
@${m.sender.split("@")[0]} Jawaban Kamu Benar 🥳
+${room.hadiah} Balance 💸

*🎮 Soal Berikutnya 🎮*

* *Deskripsi*
${deskripsi}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiahBaru} Balance
        `.trim()

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        clearTimeout(room.gameTime)
        delete sock[m.chat].tebakgambar

        let msgg 
        try {
        msgg = await sock.sendMessage(
            m.chat,
            {
                image: { url: img },
                caption: teks,
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        )
        useLimit()
        } catch (err) {
        return m.reply("Error terjadi kesalahan saat mengambil gambar soal.")
        }

        const idGame = getRandom("")
        sock[m.chat] = {}
        sock[m.chat].tebakgambar = {
            gameQuestion: deskripsi,
            gameAnswer: jawaban,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.tebakgambar
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${rm.gameAnswer}
                            `.trim()
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }

        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Tebak Gambar*\n* ${sock[m.chat].tebakgambar.gameAnswer}`
            },
            { quoted: sock[m.chat].tebakgambar.gameMessage }
        )
    }
}




if (
    !isCmd &&
    m.body.length > 1 &&
    sock[m.chat] &&
    sock[m.chat].siapakahaku &&
    sock[m.chat].siapakahaku.idGame
) {
    const gameQuestions = require("./database/game/siapakahaku.js")
    const room = sock[m.chat].siapakahaku

    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {

        const { question, answer } =
            gameQuestions[Math.floor(Math.random() * gameQuestions.length)]

        const hadiahBaru = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah

        let teks = `
@${m.sender.split("@")[0]} Jawaban Kamu Benar 🥳
+${room.hadiah} Balance 💸

*🎮 Pertanyaan Berikutnya 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiahBaru} Balance
        `.trim()

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        clearTimeout(room.gameTime)
        delete sock[m.chat].siapakahaku

        let msgg = await sock.sendMessage(
            m.chat,
            {
                text: teks,
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        )
        useLimit()

        const idGame = getRandom("")
        sock[m.chat] = {}
        sock[m.chat].siapakahaku = {
            gameQuestion: question,
            gameAnswer: answer,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.siapakahaku
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${rm.gameAnswer}
                            `.trim()
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }

        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Siapakah Aku*\n* ${sock[m.chat].siapakahaku.gameAnswer}`
            },
            { quoted: sock[m.chat].siapakahaku.gameMessage }
        )
    }
}

if (
    !isCmd &&
    m.text.length > 1 &&
    sock[m.chat] &&
    sock[m.chat].family100 &&
    sock[m.chat].family100.idGame
) {
    const room = sock[m.chat].family100
    const jawabUser = m.text.trim().toLowerCase()

    // Cek apakah jawaban cocok
    if (room.gameAnswer.includes(jawabUser)) {

        const question = room.gameQuestion

        // Hapus jawaban yg sudah ditebak
        sock[m.chat].family100.gameAnswer = room.gameAnswer.filter(v => v !== jawabUser)

        // Simpan user & jawabannya
        sock[m.chat].family100.users.push({
            user: m.sender,
            jawaban: m.text.trim()
        })
        useLimit()
        db.users[m.sender].balance += sock[m.chat].family100.hadiah

        // Jika semua jawaban habis = game selesai
        if (sock[m.chat].family100.gameAnswer.length == 0) {
            let users = ""
            for (let i of sock[m.chat].family100.users) {
                users += `@${i.user.split("@")[0]} => ${i.jawaban} (+$${sock[m.chat].family100.hadiah})\n`
            }

            let teks = `
*Game Family100 Telah Terselesaikan 🥳*

* *Pertanyaan*
${question}
*🎁 Hadiah:* $${sock[m.chat].family100.hadiah} Balance

*Daftar User Berhasil Menjawab :*
${users}
            `.trim()

            await sock.sendMessage(
                m.chat,
                {
                    text: teks,
                    contextInfo: {
                        mentionedJid: sock[m.chat].family100.users.map(e => e.user),
                        isForwarded: true,
                        forwardingScore: 9999
                    }
                },
                { quoted: m }
            )

            clearTimeout(sock[m.chat].family100.gameTime)
            delete sock[m.chat]
            return
        }

        // Jika masih ada jawaban tersisa
        let teks = `
*🎮 Game Family100 🎮*

* *Pertanyaan*
${question}
*🎁 Hadiah:* $${sock[m.chat].family100.hadiah} Balance

Masih ada ${sock[m.chat].family100.gameAnswer.length} Jawaban yang belum terjawab 📢

*Jawaban Terjawab :*
        `.trim()
        for (let i of sock[m.chat].family100.users) {
            teks += `\n@${i.user.split("@")[0]} => ${i.jawaban} (+$${sock[m.chat].family100.hadiah})`            
        }

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        sock[m.chat].family100.gameMessage = await sock.sendMessage(
            m.chat,
            {
                text: teks,
                contextInfo: {
                    mentionedJid: sock[m.chat].family100.users.map(e => e.user),
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        )
    }
}

if (!isCmd && m.body.length > 1 && sock[m.chat] && sock[m.chat].kuis && sock[m.chat].kuis.idGame) {
    const gameQuestions = require("./database/game/kuis.js")
    const room = sock[m.chat].kuis
    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {
        const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
        const hadiahBaru = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah
        let teks = `
@${m.sender.split("@")[0]} Jawaban Kamu Benar 🥳
+${room.hadiah} Balance 💸

*🎮 Next Pertanyaan Berikutnya 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiahBaru} Balance
        `.trim()
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        clearTimeout(room.gameTime)
        delete sock[m.chat].kuis
        let msgg = await sock.sendMessage(
            m.chat, {
                text: teks,
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m })
            useLimit()
        const idGame = getRandom("")
        sock[m.chat] = {}
        sock[m.chat].kuis = {
            gameQuestion: question,
            gameAnswer: answer,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.kuis
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `*Waktu Game Telah Habis ❌*\n\n*Jawabannya adalah:*\n* ${rm.gameAnswer}`.trim()
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }
        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Kuis*\n* ${sock[m.chat].kuis.gameAnswer}`
            },
            { quoted: sock[m.chat].kuis.gameMessage }
        )
    }
}

if (!isCmd && m.body.length > 1 && sock[m.chat] && sock[m.chat].tebakbendera && sock[m.chat].tebakbendera.idGame) {
    const gameQuestions = require("./database/game/tebakbendera.js")
    const room = sock[m.chat].tebakbendera
    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {
        const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
        const hadiahBaru = generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah
        let teks = `
@${m.sender.split("@")[0]} Jawaban Kamu Benar 🥳
+${room.hadiah} Balance 💸

*🎮 Next Bendera Berikutnya 🎮*

*- Bendera:* ${question}

*⏰ Waktu:* 3 menit
*🎁 Hadiah:* $${hadiahBaru} Balance
`.trim()

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        clearTimeout(room.gameTime)
        delete sock[m.chat].tebakbendera

        let msgg = await sock.sendMessage(
            m.chat,
            {
                text: teks,
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m }
        )

        useLimit()
        const idGame = getRandom("")
        sock[m.chat] = {}

        sock[m.chat].tebakbendera = {
            gameQuestion: question,
            gameAnswer: answer,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.tebakbendera
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `*Waktu Habis ❌*\n\n*Jawaban:* ${rm.gameAnswer}`
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }

        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Tebak Bendera*\n${sock[m.chat].tebakbendera.gameAnswer}`
            },
            { quoted: sock[m.chat].tebakbendera.gameMessage }
        )
    }
}

if (!isCmd && m.body.length > 1 && sock[m.chat] && sock[m.chat].tebaktebakan && sock[m.chat].tebaktebakan.idGame) {
    const gameQuestions = require("./database/game/tebaktebakan.js")
    const room = sock[m.chat].tebaktebakan
    if (room.gameAnswer.trim().toLowerCase().includes(m.body.trim().toLowerCase())) {
        const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
        const hadiahBaru = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
        db.users[m.sender].balance += room.hadiah
        let teks = `
@${m.sender.split("@")[0]} Jawaban Kamu Benar 🥳
+${room.hadiah} Balance 💸

*🎮 Next Pertanyaan Berikutnya 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiahBaru} Balance
        `.trim()
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        clearTimeout(room.gameTime)
        delete sock[m.chat].tebaktebakan
        let msgg = await sock.sendMessage(
            m.chat, {
                text: teks,
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999
                }
            },
            { quoted: m })
            useLimit()
        const idGame = getRandom("")
        sock[m.chat] = {}
        sock[m.chat].tebaktebakan = {
            gameQuestion: question,
            gameAnswer: answer,
            gameRoom: m.chat,
            hadiah: hadiahBaru,
            idGame,
            gameMessage: msgg,
            gameTime: setTimeout(() => {
                let rm = sock[m.chat]?.tebaktebakan
                if (rm && rm.idGame === idGame) {
                    sock.sendMessage(
                        rm.gameRoom,
                        {
                            text: `*Waktu Game Telah Habis ❌*\n\n*Jawabannya adalah:*\n* ${rm.gameAnswer}`.trim()
                        },
                        { quoted: rm.gameMessage }
                    )
                    delete sock[m.chat]
                }
            }, 180000)
        }
        await sock.sendMessage(
            global.owner + "@s.whatsapp.net",
            {
                text: `*Jawaban Game Tebak Tebakan*\n* ${sock[m.chat].tebaktebakan.gameAnswer}`
            },
            { quoted: sock[m.chat].tebaktebakan.gameMessage }
        )
    }
}

let afkUser = m?.mentionedJid[0]
if (afkUser && m.isGroup && db.users[afkUser]?.afk.status) {
let data = db.users[afkUser].afk
let dur = Date.now() - data.afkTime
let reason = db.users[afkUser].afk.reason
await m.reply(`Heii Jangan Tag Dia 🤫\nDia sedang AFK selama _${clockString(dur)}_\n*Alasan AFK:* ${reason}`)
}


// ===== Helper =====
const headerUserWithBot = async (m) => {
  const totalUser = Object.keys(db.users).length
  const data = db.users[m.sender]
  const limit = data.limit
  const balance = await toRupiah(data.balance)
  const name = data.name
  const premium = isOwner ? "Developer" : data.premium ? "Premium User 👑" : "Free User"

  return `
╭━━━〔 👋 WELCOME 〕━━━⬣
┃ Haii ${ucapan()} @${m.sender.split("@")[0]}
┃ Senang kamu datang 🚀
╰━━━━━━━━━━━━━━━━━━⬣

╭━━━〔 🤖 BOT INFO 〕━━━⬣
┃ ✦ Name     : ${global.botname}
┃ ✦ Version  : ${global.versibot}
┃ ✦ Runtime  : ${runtime(process.uptime())}
┃ ✦ Users    : ${totalUser}
╰━━━━━━━━━━━━━━━━━━⬣

╭━━━〔 👤 USER INFO 〕━━━⬣
┃ ✦ Name     : ${name}
┃ ✦ Limit    : ${limit}
┃ ✦ Balance  : $${balance}
┃ ✦ Status   : ${premium}
╰━━━━━━━━━━━━━━━━━━⬣
`
}

const rowsMenu = [
  { title: "⭐ All Menu", id: ".allmenu", description: "Menampilkan semua list menu bot" },
  { title: "📌 Main Menu", id: ".mainmenu", description: "Menampilkan list main menu" },
  { title: "🎨 Creator Menu", id: ".creatormenu", description: "Menampilkan list creator menu" },
  { title: "⬇️ Download Menu", id: ".downloadmenu", description: "Menampilkan list download menu" },
  { title: "🔎 Search Menu", id: ".searchmenu", description: "Menampilkan list search menu" },
  { title: "🛠️ Tools Menu", id: ".toolsmenu", description: "Menampilkan list tools menu" },
  { title: "🎉 Fun Menu", id: ".funmenu", description: "Menampilkan list fun menu" },
  { title: "🎮 Game Menu", id: ".gamemenu", description: "Menampilkan list game menu" },
  { title: "🛍️ Store Menu", id: ".storemenu", description: "Menampilkan list store menu" },
  { title: "👥 Grup Menu", id: ".grupmenu", description: "Menampilkan list grup menu" },
  { title: "🔐 Obfuscator Menu", id: ".obfmenu", description: "Menampilkan list obfuscator menu" },
  { title: "📢 Channel Menu", id: ".channelmenu", description: "Menampilkan list channel menu" },
  { title: "🖥️ Panel Menu", id: ".panelmenu", description: "Menampilkan list panel menu" },
  { title: "☁️ DigitalOcean Menu", id: ".domenu", description: "Menampilkan list DigitalOcean menu" },
  { title: "⚙️ Setbot Menu", id: ".setbotmenu", description: "Menampilkan list setbot menu" },
  { title: "👑 Owner Menu", id: ".ownermenu", description: "Menampilkan list owner menu" }
];



const sendMenuWithButton = async (m, teks) => {
  const messageParams = {
    limited_time_offer: {
      text: `${global.botname} - ${global.versibot}`,
      url: "https://t.me/Xskycode",
      copy_code: "1",
      expiration_time: 0
    },
    bottom_sheet: {
      in_thread_buttons_limit: 2,
      divider_indices: [1, 2, 3, 4, 5, 999],
      list_title: "1",
      button_title: "1"
    },
    tap_target_configuration: {
      title: "1",
      description: "bomboclard",
      canonical_url: "https://shop.example.com/angebot",
      domain: "shop.example.com",
      button_index: 0
    }
  }
  
  global.imageMenu = global.imageMenu ? global.imageMenu : await prepareWAMessageMedia({ image: { url: global.thumb } },{ upload: sock.waUploadToServer })

  const msg = await generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessageV2: {
        message: {
          interactiveMessage: {
            header: {
              ...global.imageMenu, 
              hasMediaAttachment: true
            },

            body: { text: teks },

            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "List Menu",
                    sections: [
                      {
                        title: `© Powered By ${global.botname}`,
                        highlight_label: "Recommended",
                        rows: rowsMenu
                      }
                    ]
                  })
                }, 
                                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "List Menu",
                    sections: [
                      {
                        title: `© Powered By ${global.botname}`,
                        highlight_label: "Recommended",
                        rows: rowsMenu
                      }
                    ]
                  })
                }
              ],

              messageParamsJson: JSON.stringify(messageParams)
            },

            contextInfo: {
              mentionedJid: [
                m.sender,
                global.owner + "@s.whatsapp.net"
              ],
              isForwarded: true,

              businessMessageForwardInfo: {
                businessOwnerJid:
                  global.owner + "@s.whatsapp.net"
              },

              forwardedNewsletterMessageInfo: {
                newsletterName: global.namaChannel,
                newsletterJid: global.idChannel
              },

              externalAdReply: {
                sourceUrl: global.linkChannel
              }
            }
          }
        }
      }
    },
    { userJid: m.sender, quoted: null }
  )

  return sock.relayMessage(m.chat, msg.message, {
    messageId: msg.key.id
  })
}

switch (command) {

case "menu": {
  let teks = await headerUserWithBot(m)
  await sendMenuWithButton(m, teks, true)
}
break

case "mainmenu": {
  let teks = ""
  teks += global.mainmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "creatormenu": {
  let teks = ""
  teks += global.creatormenu
  await sendMenuWithButton(m, teks, true)
}
break

case "downloadmenu": {
  let teks = ""
  teks += global.downloadmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "searchmenu": {
  let teks = ""
  teks += global.searchmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "toolsmenu": {
  let teks = ""
  teks += global.toolsmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "funmenu": {
  let teks = ""
  teks += global.funmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "gamemenu": {
  let teks = ""
  teks += global.gamemenu
  await sendMenuWithButton(m, teks, true)
}
break

case "storemenu": {
  let teks = ""
  teks += global.storemenu
  await sendMenuWithButton(m, teks, true)
}
break

case "grupmenu": {
  let teks = ""
  teks += global.grupmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "obfmenu": {
  let teks = ""
  teks += global.obfmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "channelmenu": {
  let teks = ""
  teks += global.channelmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "panelmenu": {
  let teks = ""
  teks += global.panelmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "domenu": {
  let teks = ""
  teks += global.domenu
  await sendMenuWithButton(m, teks, true)
}
break

case "setbotmenu": {
  let teks = ""
  teks += global.setbotmenu
  await sendMenuWithButton(m, teks, true)
}
break

case "ownermenu": {
  let teks = ""
  teks += global.ownermenu
  await sendMenuWithButton(m, teks, true)
}
break

case "allmenu": {
  let teks = ""
  teks += global.allmenu
  await sendMenuWithButton(m, teks, true)
}
break

//==================================//

    case "cekganteng": {
        if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

        let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;
        const randomPercent = () => Math.floor(Math.random() * 101);

        let teks = `
---- CEK GANTENG ----
Nama: @${target.split("@")[0]}
Tingkat Ganteng: *${randomPercent()}%* 🗿
`;
        return Reply(teks, [target]);
    }
    break;

    case "cekcantik": {
        if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

        let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;
        const randomPercent = () => Math.floor(Math.random() * 101);

        let teks = `
---- CEK CANTIK ----
Nama: @${target.split("@")[0]}
Tingkat Cantik: *${randomPercent()}%* 💖
`;
        return Reply(teks, [target]);
    }
    break;
    
case "cekmemek": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;

    // Fungsi random helper
    const randomPercent = () => Math.floor(Math.random() * 101); // 0-100%
    const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)]; // Pilih random dari array

    // Random atribut
    const warnaKulit = randomChoice(['Putih', 'Sawo matang', 'Hitam', 'Kuning langsat', 'Coklat']);
    const ketebalanBulu = randomChoice(['Tipis', 'Sedang', 'Tebal', 'Sangat Tebal']);
    const besarLobang = randomChoice(['Kecil', 'Sedang', 'Besar', 'Sangat besar']);
    const perawan = randomChoice(['Yes', 'Tidak']);

    let teks = `
---- CEK MEMEK ----
Nama: @${target.split("@")[0]}
Warna Kulit: *${warnaKulit}*
Ketebalan Bulu: *${ketebalanBulu}*
Besar Lobang: *${besarLobang}*
Perawan: *${perawan}*
`;

    return Reply(teks, [target]);
}
break;    

case "cekkontol": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;

    // Random helper
    const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Random atribut
    const warna = randomChoice(['Putih', 'Sawo matang', 'Hitam', 'Coklat', 'Merah muda']);
    const panjang = randomChoice(['Kecil', 'Sedang', 'Besar', 'Super Besar']);
    const ketebalan = randomChoice(['Tipis', 'Sedang', 'Tebal', 'Sangat Tebal']);
    const bentuk = randomChoice(['Lurus', 'Bengkok', 'Melengkung', 'Unik']);
    const perjaka = randomChoice(['Yes', 'Tidak']);

    let teks = `
---- CEK KONTOL ----
Nama: @${target.split("@")[0]}
Warna: *${warna}*
Ukuran: *${panjang}*
Ketebalan Bulu: *${ketebalan}*
Bentuk: *${bentuk}*
Perjaka: *${perjaka}*
`;

    return Reply(teks, [target]);
}
break;

    case "cekidiot": {
        if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

        let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;
        const randomPercent = () => Math.floor(Math.random() * 101);

        let teks = `
---- CEK IDIOT ----
Nama: @${target.split("@")[0]}
Tingkat Idiot: *${randomPercent()}%* 🤪
`;
        return Reply(teks, [target]);
    }
    break;

    case "cektolol": {
        if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

        let target = m.mentionedJid?.[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender;
        const randomPercent = () => Math.floor(Math.random() * 101);

        let teks = `
---- CEK TOLOL ----
Nama: @${target.split("@")[0]}
Tingkat Kelolaan: *${randomPercent()}%* 😂
`;
        return Reply(teks, [target]);
    }
    break;
    
        case "artinama": {
        if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");
        if (!text) return Reply(`*ex:* ${cmd} SilenceVanzxy`)

const axios = require('axios');
const cheerio = require('cheerio');

async function getArtiNama(nama) {
    try {
        const url = `https://www.primbon.com/arti_nama.php?nama1=${encodeURIComponent(nama)}&proses=+Submit%21+`;
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.35 Mobile Safari/537.36',
                'Accept': 'text/html',
                'x-requested-with': 'mark.via.gp',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(html);
        let arti = '';
        $('body').find('center, b, i').each((i, el) => {
            const text = $(el).parent().text();
            if (text.includes('memiliki arti:')) {
                arti = text.split('memiliki arti:')[1].trim().split('\n')[0];
            }
        });

        return arti ? `Arti nama ${nama}: ${arti}` : `Maaf, arti nama "${nama}" tidak ditemukan.`;

    } catch (err) {
        return `Terjadi kesalahan: ${err.message}`;
    }
}

const result = await getArtiNama(text.trim())
        await Reply(result);
        useLimit()
    }
    break;

//==================================//

case "own": case "owner": {
await sock.sendContact(m.chat, [global.owner], global.ownername, "Developer Bot", m)
}
break

//==================================//

case "npmdl": {
   if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
   if (!text) return Reply(`*ex:* ${cmd}  @whiskeysockets/baileys`)
    try {
        const axios = require("axios");
        const fs = require("fs");
        const path = require("path");
        const tar = require("tar");
        const AdmZip = require("adm-zip");
        let pkgName = text.trim();
        const info = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`);
        const version = info.data["dist-tags"].latest;
        const meta = await axios.get(
            `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/${version}`
        );
        const tarballUrl = meta.data.dist.tarball;
        if (!tarballUrl) return Reply("❌ Tarball tidak ditemukan untuk package ini.");
        await Reply(`📦 Mengunduh *${pkgName} versi terbaru ${version}*...`);
        const tmpDir = path.join(process.cwd(), "sampah");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const tarballPath = path.join(tmpDir, `${pkgName.replace(/[\/@]/g, "_")}-${version}.tgz`);
        const extractPath = path.join(tmpDir, `${pkgName.replace(/[\/@]/g, "_")}-${version}`);
        const res = await axios.get(tarballUrl, { responseType: "arraybuffer" });
        fs.writeFileSync(tarballPath, res.data);
        fs.mkdirSync(extractPath, { recursive: true });
        await tar.x({ file: tarballPath, cwd: extractPath, strip: 1 });
        const zip = new AdmZip();
        zip.addLocalFolder(extractPath);
        const zipPath = path.join(tmpDir, `${pkgName.replace(/[\/@]/g, "_")}-${version}.zip`);
        zip.writeZip(zipPath);
        await sock.sendMessage(
            m.chat,
            {
                document: fs.readFileSync(zipPath),
                mimetype: "application/zip",
                fileName: `${pkgName.replace("/", "_")}-${version}.zip`,
                caption: `✅ Berhasil mengunduh *${pkgName}@${version}*`
            },
            { quoted: m }
        );
        useLimit()
        fs.unlinkSync(tarballPath);
        fs.rmSync(extractPath, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
    } catch (err) {
        console.error(err);
        await Reply("❌ Gagal mengunduh package.\nPastikan nama package benar.\n\n" + err.message);
    }
}
break;

//==================================//

case "tt":
case "tiktok":
case "ttdl": {
    if (!cekLimit())
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    if (!text)
        return Reply(`*ex:* ${cmd} https://vt.tiktok.com/xxxx`);

    if (!text.startsWith("http"))
        return Reply(`*ex:* ${cmd} https://vt.tiktok.com/xxxx`);

    try {
        const axios = require("axios");

        await Reply("⏳ Mengambil data TikTok...");

        const apiUrl = `https://api.serverweb.qzz.io/download/tiktok?apikey=skyy&url=${encodeURIComponent(text)}`;
        const { data: res } = await axios.get(apiUrl);

        if (!res?.status || !res?.result)
            return Reply("❌ Gagal mengambil data TikTok.");

        const d = res.result;
        const caption = d.caption || "Tiktok Downloader ✅";

        // === SLIDE / PHOTO ===
        if (d.type === "photo" && Array.isArray(d.slide)) {
            let album = [];
            for (let img of d.slide) {
                album.push({
                    image: { url: img },
                    caption
                });
            }

            await sock.sendMessage(
                m.chat,
                { album },
                { quoted: m }
            );

            // kirim audio jika ada
            if (d.audio) {
                await sock.sendMessage(
                    m.chat,
                    {
                        audio: { url: d.audio },
                        mimetype: "audio/mpeg",
                        ptt: false
                    },
                    { quoted: m }
                );
            }

            useLimit();
            return;
        }

        // === VIDEO ===
        if (d.video) {
            await sock.sendMessage(
                m.chat,
                {
                    video: { url: d.video },
                    caption
                },
                { quoted: m }
            );

            // kirim audio jika ada
            if (d.audio) {
                await sock.sendMessage(
                    m.chat,
                    {
                        audio: { url: d.audio },
                        mimetype: "audio/mpeg",
                        ptt: false
                    },
                    { quoted: m }
                );
            }

            useLimit();
        }

    } catch (err) {
        console.error("TikTok DL Error:", err.response?.data || err);
        Reply("❌ Terjadi kesalahan saat memproses TikTok.");
    }
}
break;

//==================================//

case "gitclone": case "git": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) {
    return Reply(`*ex:* ${cmd} https://github.com/kiuur/laurine-wabot`)
  }
  let regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
  if (!regex.test(text)) {
    return Reply(`*ex:* ${cmd} https://github.com/kiuur/laurine-wabot`)
  }
  await Reply("Fetching github Repositori...")
  try {
    let [, user, repo] = text.match(regex) || [];
    repo = repo.replace(/\.git$/, '');
    let url = `https://api.github.com/repos/${user}/${repo}/zipball`;
    let res = await fetch(url, { method: 'HEAD' });
    let cd = res.headers.get('content-disposition');
    let filename = cd.match(/attachment; filename="?([^"]+)"?/)[1];
    await sock.sendMessage(m.chat, {
      document: { url },
      mimetype: 'application/zip',
      fileName: filename,
      caption: "Github Downloader ✅"
    }, { quoted: m });
    useLimit()
  } catch (e) {
    console.error(e);
    await Reply(`Error! Repositori tidak ditemukan atau link tidak valid.`);
  }
}
break

//==================================//

case "mediafire":
case "mddl": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply(`*ex:* ${cmd} https://www.mediafire.com/file/xxx`);
  if (!text.startsWith("https://"))
    return Reply(`*ex:* ${cmd} https://www.mediafire.com/file/xxx`);
  const res = await mediafire(`${text}`);
  if (!res.url) return Reply("Error! result tidak ditemukan atau link tidak valid.");
  await Reply(`🔍 Sedang mendeteksi MIME type...`);
  async function getTypeUrlMedia(url) {
    const axios = require("axios");
    const FileType = require("file-type");
    try {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.mediafire.com/",
      };
      const buffer = await axios.get(url, {
        responseType: "arraybuffer",
        headers,
        maxRedirects: 10,
      });
      const type =
        buffer.headers["content-type"] ||
        (await FileType.fromBuffer(buffer.data)).mime ||
        "application/octet-stream";

      return { type, url };
    } catch (err) {
      console.error("Gagal mendeteksi MIME type:", err.message);
      return { type: "application/octet-stream", url };
    }
  }
  const detected = await getTypeUrlMedia(res.url);
  await sock.sendMessage(
    m.chat,
    {
      document: { url: res.url },
      fileName: res.fileName,
      mimetype: detected.type,
      caption: "MediaFire Downloader ✅",
    },
    { quoted: m }
  );
  useLimit()
}
break;

//==================================//

case "play": case "playyt": case "ytplay": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!text) return Reply(`*ex:* ${cmd} audio meme 30 detik`)
const ress = await Yts(text)
if (ress.all.length < 1) return Reply("Gagal! Audio/vidio tidak ditemukan.")
await Reply("Memproses download audio, tunggu sebentar...")
const { title, url, thumbnail, timestamp, author } = ress.all[0]
const res = await fetchJson(`https://api.serverweb.qzz.io/download/ytdl-mp3?apikey=skyy&url=${url}`)
if (!res.result.download) return Reply("Error! terjadi kesalahan saat mengambil audio.")
return sock.sendMessage(m.chat, {audio: {url: res.result.download}, mimetype: "audio/mpeg", ptt: false, contextInfo: {
externalAdReply: {
title: title, 
body: `Duration: ${timestamp} || Creator: ${author.name}`, 
thumbnailUrl: thumbnail,
renderLargerThumbnail: true, 
mediaType: 1, 
sourceUrl: url
}
}}, { quoted: m })
useLimit()
}
break

case "ytmp4": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text || !text.includes("https://")) return Reply(`*ex:* ${cmd} https://youtu.be/xxx`)

    try { 
        const url = text.trim()
        const data = await fetchJson(`https://api.serverweb.qzz.io/download/ytdl-mp4?apikey=skyy&url=${url}`)
        await Reply("Sedang memproses video... 🔄")        
        if (!data?.result?.download) return Reply("Error! data vidio tidak ditemukan.")       
        await sock.sendMessage(
            m.chat,
            {
                video: { url: data.result.download },
                mimetype: "video/mp4"
            },
            { quoted: m }
        )

        useLimit()

    } catch (err) {
        console.log(err)
        Reply("Error! Terjadi kesalahan saat mengambil video")
    }
}
break

case "ytmp3": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text || !text.includes("https://")) return Reply(`*ex:* ${cmd} https://youtu.be/xxx`)
    try {        
        let url = text.trim()
        await Reply("Sedang memproses audio... 🔄")
        const data = await fetchJson(`https://api.serverweb.qzz.io/download/ytdl-mp3?apikey=skyy&url=${url}`)        
        if (!data?.result?.download) return Reply("Error! data audio tidak ditemukan.")

        await sock.sendMessage(
            m.chat,
            {
                audio: { url: data.result.download },
                mimetype: "audio/mpeg",
                ptt: false
            },
            { quoted: m }
        )

        useLimit()

    } catch (err) {
        console.log(err)
        Reply("Error! Terjadi kesalahan saat mengambil audio")
    }
}
break

//==================================//

case "spotifydl": case "spodl": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text || !text.includes("https://")) return Reply(`*ex:* ${cmd} https://open.spotify.com/track/xxx`)

    try {
        let url = text
        await Reply("Downloading audio, tunggu sebentar...")
        const data = await fetchJson(`https://api.serverweb.qzz.io/download/spotify2?apikey=skyy&url=${url}`)        
        if (!data?.result?.url) return Reply("Error! data Spotify tidak ditemukan.")

        await sock.sendMessage(
            m.chat,
            {
                audio: { url: data.result.url },
                mimetype: "audio/mpeg",
                ptt: false
            },
            { quoted: m }
        )

        useLimit()

    } catch (err) {
        console.log(err)
        m.reply("Terjadi kesalahan saat mengambil audio")
    }
}
break

//==================================//

case "igdl": case "instagram": case "ig": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} https://www.instagram.com/reel/xxx`)

    try {
        let url = text
        if (!/instagram\.com/.test(text)) return Reply(`*ex:* ${cmd} https://www.instagram.com/reel/xxx`)
        await Reply("Downloading instagram, tunggu sebentar...")
        const data = await fetchJson(`https://api.serverweb.qzz.io/download/instagram?apikey=skyy&url=${url}`).then(res => res.result)
        const album = []
        if (!data[0]?.url_download) return Reply("Error! data Instagram tidak ditemukan.")
        for (let i of data) {
        if (/Video/.test(i.kualitas)) {
        await sock.sendMessage(
            m.chat,
            {
                video: { url: i.url_download },
                caption: "Instagram Downloader ✅", 
                mimetype: "video/mp4"
            },
            { quoted: m }
        )
        } else {
        album.push({
                image: { url: i.url_download },
                caption: `Instagram Downloader ✅`
            })
        }
        }
        
        if (album.length > 1) await sock.sendAlbum(
            m.chat,
            { albumMessage: album },
            m
        )

        useLimit()

    } catch (err) {
        console.log(err)
        Reply("Terjadi kesalahan saat mengambil video")
    }
}
break

//==================================//

case "fbdl": case "facebook": case "fb": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} https://facebook.com/share/v/xxx/`)
    try {
        await Reply("Downloading facebook, tunggu sebentar...")
        let url = text
        if (!/facebook\.com/.test(text)) return Reply(`*ex:* ${cmd} https://facebook.com/share/v/xxx/`)
        const data = await fbdl(url)
        if (!data?.media) return Reply("Error! data vidio tidak ditemukan.")
        await sock.sendMessage(
            m.chat,
            {
                video: { url: data.media },
                caption: "Facebook Downloader ✅", 
                mimetype: "video/mp4"
            },
            { quoted: m }
        )        
        useLimit()
    } catch (err) {
        console.log(err)
        Reply("Terjadi kesalahan saat mengambil video")
    }
}
break

//==================================//

case "openai": case "ai": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`Masukan pertanyaan!\n*ex:* ${cmd} jelaskan apa itu javascript`);
    const res = await fetchJson(`https://api.serverweb.qzz.io/ai/groq?apikey=skyy&question=${text}`)
    if (!res.result) return Reply("Error! terjadi kesalahan fetch API Gpt.")
    useLimit()
    return m.reply(`*--*\n${res.result}`)
}
break

//==================================//

case "xnxx": case "xnxxs": case "xnxxsearch": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} cosplayer anime`);
    try {
    const r = await fetchJson(`https://api.serverweb.qzz.io/search/xnxx?apikey=skyy&query=${text}`).then(res => res.result)
    if (!r || r.length < 1) return Reply(`Data vidio tidak ditemukan.`)
    let msg = ``.trim()
    for (let i of r) {
    msg += `\n- *Title:* ${i.title}\n- Duration: ${i.duration}\n- ${i.link}\n`
    }
    useLimit()
    return m.reply(msg)
    } catch (err) {
    console.log(err)
    Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break


case "xhamster": case "xhamsters": case "xhamstersearch": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} cosplayer anime`)
    try {
        const r = await fetchJson(
            `https://api.serverweb.qzz.io/search/xhamster?apikey=skyy&q=${text}`
        ).then(res => res.result)

        if (!r || r.length < 1) return Reply(`Data vidio tidak ditemukan.`)

        let msg = ``
        for (let i of r) {
            msg += `\n- *Title:* ${i.title}\n- Duration: ${i.duration}\n- ${i.previewVideo}\n`
        }

        useLimit()
        return m.reply(msg)
    } catch (err) {
        console.log(err)
        Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break

//==================================//

case "xnxxdl": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} https://www.xnxx.com/xxx`);
    try {
    await Reply("Downloading XNXX, tunggu sebentar...")
    const r = await fetchJson("https://api.serverweb.qzz.io/download/bstation?apikey=skyy&url="+text);
    if (!r || !r.result?.mp4 || r.result?.mp4.length < 1) return Reply(`Data XNXX vidio tidak ditemukan.`)
    let msg = `XNXX Downloader ✅`.trim()
    await sock.sendMessage(m.chat, { video: { url: r.result.mp4[0].url }, mimetype: "video/mp4", caption: msg }, { quoted: m })
    useLimit()
    } catch (err) {
    console.log(err)
    Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break

//==================================//

case "npm": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply(`*ex:* ${cmd} baileys`)

  const axios = require("axios")
  const query = text.trim()

  try {
    // Coba stalk 1 package dulu
    const r = await npmjs(query)

    const msg = `
📦 *NPM Package Info*
- *Name:* ${r.name}
- *Latest Version:* ${r.versionLatest}
- *First Published:* ${r.versionPublish}
- *Total Updates:* ${r.versionUpdate}

📚 *Dependencies*
- Latest Version: ${r.latestDependencies}
- First Publish: ${r.publishDependencies}

⏱ *Publish Time*
- First Publish: ${new Date(r.publishTime).toLocaleString()}
- Latest Update: ${new Date(r.latestPublishTime).toLocaleString()}

🌐 https://www.npmjs.com/package/${r.name}
`.trim()

    useLimit()
    return m.reply(msg)

  } catch (e) {
    try {
      // Kalau gagal, fallback ke npm search API
      const { data } = await axios.get(
        `https://api.npms.io/v2/search?q=${encodeURIComponent(query)}`
      )

      if (!data.results || data.results.length === 0) {
        return Reply(`Package *${query}* tidak ditemukan.`)
      }

      let msg = `🔎 *NPM Search Result*\nQuery: *${query}*\nTotal: *${data.total}*\n\n`

      data.results.slice(0, 5).forEach((item, i) => {
        const p = item.package
        msg += `📦 *${i + 1}. ${p.name}*\n`
        msg += `- Version: ${p.version}\n`
        msg += `- Desc: ${p.description || "-"}\n`
        msg += `- Author: ${p.author?.name || "-"}\n`
        msg += `- Link: ${p.links?.npm}\n\n`
      })

      useLimit()
      return m.reply(msg.trim())

    } catch (err) {
      console.log(err)
      return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
  }
}
break

//==================================//

case "ocr": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");
    if (!/image/.test(mime)) return Reply(`Kirim atau balas foto dengan ketik *${cmd}*`)
    await Reply(`Mengambil Text dari image...`)
    try {
    const buf = m.quoted ? await m.quoted.download() : await m.download()
    const urls = await uploadImageBuffer(buf)
    const { ocrSpace } = require('ocr-space-api-wrapper')
      const anuin = await ocrSpace(urls)
    if (!anuin.ParsedResults) return Reply(`Text tidak ditemukan.`)
      const anu = anuin.ParsedResults[0].ParsedText
    await m.reply(`\n*--*\n${anu.trim()}`)
    useLimit();
    } catch (err) {
    console.log(err);
    return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break

//==================================//

case "translate":
case "tr": {
  if (!cekLimit()) {
    return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  }

  if (!text && !(m.quoted && m.quoted.text)) {
    return Reply(`*ex:* ${cmd} id i love you`)
  }

  let lang = "id"
  let data = ""

  if (text) {
    const args = text.trim().split(" ")

    if (/^[a-z]{2}$/i.test(args[0])) {
      lang = args[0].toLowerCase()
      data = args.slice(1).join(" ").trim()
    } else {
      lang = "id"
      data = text.trim()
    }
  }

  if (m.quoted && m.quoted.text) {
    data = m.quoted.text.trim()
  }

  if (!data) {
    return Reply(`*ex:* ${cmd} id i love you`)
  }

  try {
    const result = await translate(data, { to: lang })
    const output = `*Translate to ${lang}:*\n${result[0]}`
    await m.reply(output)
    useLimit()
  } catch (e) {
    return Reply("🚩 Language code not supported or translation failed.")
  }
}
break

//==================================//

case "tts": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");
    if (!text) return Reply(`*ex:* ${cmd} haii selamat siang sayangg`);
    try {
    await Reply("Converting text to audio...")
    const result = await fetchJson(`https://api.serverweb.qzz.io/tools/tts?apikey=skyy&text=${text}`).then(i => i.result)
    if (!result.url) return Reply(`Error! terjadi kesalahan saat convert audio.`)  
    const link = result.url
    await sock.sendMessage(m.chat, { audio: { url: link }, mimetype: "audio/mpeg", ptt: false }, { quoted: m })
    useLimit();
    } catch (err) {
    console.log(err);
    return Reply(`Error! terjadi kesalahan saat convert audio.`)
    }
}
break

//==================================//

case "ttstalk": case "tiktokstalk": {
    if (!cekLimit()) 
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");
    if (!text) return Reply(`*ex:* ${cmd} username`);
    try {
        const r = await ttStalk(text.trim());
        if (!r || !r.uniqueId) return Reply(`Data akun tiktok username *${text}* tidak ditemukan.`);
        const caption = `
🎵 *TikTok User Stalk*

👤 *Username:* ${r.uniqueId}
🏷️ *Nickname:* ${r.nickname || "-"}
${r.verified ? "✔️ *Verified Account*" : "❌ *Not Verified*"}

📊 *Statistics*
- Followers: ${r.followers}
- Following: ${r.following}
- Likes: ${r.likes}
- Videos: ${r.videos}

🆔 *User ID:* ${r.id}

🔗 https://www.tiktok.com/@${r.uniqueId}
`.trim();
        await sock.sendMessage(
            m.chat,
            {
                image: { url: r.avatar },
                caption
            },
            { quoted: m }
        );
        useLimit();
    } catch (err) {
        console.log(err);
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "igstalk":
case "instagramstalk": {
    if (!cekLimit()) 
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");
    if (!text) 
        return Reply(`*ex:* ${cmd} username`);

    try {
        const url = `https://api.serverweb.qzz.io/stalk/instagram?apikey=skyy&username=${text}`;
        const res = await fetch(url);
        const json = await res.json();

        if (!json.status || !json.result)
            return Reply(`Data akun instagram username *${text}* tidak ditemukan.`);

        const r = json.result;

        const caption = `
📸 *Instagram User Stalk*

👤 *Username:* ${r.username}
🏷️ *Full Name:* ${r.full_name || "-"}
📝 *Bio:* ${r.bio || "-"}

${r.verified ? "✔️ *Verified Account*" : "❌ *Not Verified*"}
${r.private ? "🔒 *Private Account*" : "🔓 *Public Account*"}

📊 *Statistics*
- Followers: ${r.followers}
- Following: ${r.following}
- Posts: ${r.posts}

🆔 *User ID:* ${r.id}

🔗 https://www.instagram.com/${r.username}/
`.trim();

        await sock.sendMessage(
            m.chat,
            {
                image: { url: r.avatar },
                caption
            },
            { quoted: m }
        );

        useLimit();
    } catch (err) {
        console.log(err);
        return Reply("Error! terjadi kesalahan saat Fetching API.");
    }
}
break;

//==================================//

case "pinterest":
case "pin": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} logo hosting keren`)

    try {
        await Reply(`Mencari foto *${text}* Pinterest...`)
        const data = await fetchJson(`https://api.serverweb.qzz.io/search/pinterest?apikey=skyy&q=${text}`).then(res => res.result)
        if (data.length < 1) return Reply(`Result Pinterest *${text}* tidak ditemukan.`)
        const result = data.map(v => v)

        let jumlah = 5
        if (result.length < jumlah) jumlah = result.length

        const album = []
        for (let i = 0; i < jumlah; i++) {
            album.push({
                image: { url: result[i] },
                caption: `Result Pinterest *${text}*`
            })
        }

        await sock.sendAlbum(
            m.chat,
            { albumMessage: album },
            m
        )

        useLimit()

    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "spotifysearch": case "spoti": case "spotify": case "spo": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} anymore`)

    try {
        await Reply(`Mencari Spotify Track *${text}*...`)
        const data = await fetchJson(`https://api.serverweb.qzz.io/search/spotify?apikey=skyy&q=${text}`)
        if (data.result.length < 1) return Reply(`Spotify Track *${text}* tidak ditemukan.`)
       teks = ""
       for (let i of data.result) {
       teks += `\n- *Judul:* ${i.title}\n- *Artis:* ${i.artist}\n- ${i.spotify_url}\n`
       }

        useLimit()
        return m.reply(teks)

    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "yts": case "ytsearch": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} music phonk tiktok viral`)

    try {
        await Reply(`Mencari data *${text}* dari Youtube...`)
        const data = await Yts(`${text}`)
        if (data.all.length < 1) return Reply(`Hasil pencarian tidak ditemukan.`)
       teks = ""
       for (let i of data.all) {
       const { title, url, thumbnail, timestamp, author } = i
       teks += `\n- *Judul:* ${i.title}\n- Channel: ${author?.name || "Tidak diketahui"}\n- *Durasi:* ${timestamp}\n- ${i.url}\n`
       }

        useLimit()
        return m.reply(teks)

    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "nsfw": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    try {
        const Image = `https://api.serverweb.qzz.io/random/nsfw?apikey=skyy`
        await sock.sendMessage(m.chat, { image: { url: Image }, caption: "NSFW Random Images 💦" }, { quoted: m })
        return useLimit()
    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "cosplay": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    try {
        const Image = `https://api.serverweb.qzz.io/random/cosplay?apikey=skyy`
        await sock.sendMessage(m.chat, { image: { url: Image }, caption: "NSFW Random Cosplayer Images 🌟" }, { quoted: m })
        return useLimit()
    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "sfile": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} Script Bot WhatsApp`)

    try {
        await Reply(`Mencari data *${text}* Sfile.mobi...`)
        const data = await fetchJson(`https://api.serverweb.qzz.io/search/sfile?apikey=skyy&q=${text}`).then(i => i.result)
       if (!data || data.length < 1) return Reply(`Hasil pencarian *${text}* tidak ditemukan.`)
       teks = ""
       for (let i of data) {
       const { title, link, size } = i
       teks += `\n- *Name:* ${title}\n- *Size:* ${size || "Tidak diketahui"}\n- ${link}\n`
       }

        useLimit()
        return m.reply(teks)

    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;

case "bokep": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} mahasiswa\n*Noted:* dosa tanggung sendiri!`)
    try {
        const data = await fetchJson(`https://api.serverweb.qzz.io/search/bokep?apikey=skyy&q=${text}`).then(i => i.result)
       if (data.results < 1) return Reply(`Hasil pencarian vidio tidak ditemukan.`)
       teks = ""
       for (let i of data.results) {
       const { title, download, duration } = i
       teks += `\n- *Judul:* ${title}\n- *Durasi:* ${duration}\n- ${download}\n`
       }

        useLimit()
        return m.reply(teks)

    } catch (err) {
        console.log(err)
        m.reply("Terjadi kesalahan!")
    }
}
break;

case "gimage": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} wallpaper anime hd`)

    try {
        const data = await fetchJson(`https://api.serverweb.qzz.io/search/gimage?apikey=skyy&q=${text}`).then(res => res.result)
        if (data.images < 1) return Reply(`Hasil pencarian foto *${text}* tidak ditemukan.`)
        const result = data.images.map(v => v.imageUrl)

        let jumlah = 5
        if (result.length < jumlah) jumlah = result.length

        const album = []
        for (let i = 0; i < jumlah; i++) {
            album.push({
                image: { url: result[i] },
                caption: `Hasil pencarian Google: *${text}*`
            })
        }

        await sock.sendAlbum(
            m.chat,
            { albumMessage: album },
            m
        )

        useLimit()

    } catch (err) {
        console.log(err)
        return Reply(`Error! terjadi kesalahan saat Fetching API.`)
    }
}
break;


case "sticker": case "stiker": case "sgif": case "s": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!/image|video/.test(mime)) return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
if (/video/.test(mime)) {
if ((qmsg).seconds > 15) return Reply("Durasi vidio maksimal 15 detik!")
}
try {
var media = await sock.downloadAndSaveMediaMessage(qmsg)
await sock.sendSticker(m.chat, media, m, {packname: "SilenceVanzxy"})
useLimit()
} catch (err) {
console.log(err)
return Reply(`Error! gagal convert gambar to sticker.`)
}
}
break

//==================================//

case "stickerwm": case "swm": case "wm": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!text) return Reply(`*ex:* ${cmd} <teksnya> dengan kirim atau reply image`)
if (!/image|video/.test(mime)) return Reply(`*ex:* ${cmd} <teksnya> dengan kirim atau reply image`)
if (/video/.test(mime)) {
if ((qmsg).seconds > 15) return Reply("Durasi vidio maksimal 15 detik!")
}
try {
var media = await sock.downloadAndSaveMediaMessage(qmsg)
await sock.sendSticker(m.chat, media, m, {packname: text})
useLimit()
} catch (err) {
console.log(err)
return Reply(`Error! gagal convert gambar to sticker.`)
}
}
break

case "attp": {
  if (!cekLimit())
    return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

  if (!text)
    return Reply(`*ex:* ${cmd} halo dunia`);

  const { generateATTPWebm } = require("SilenceVanzxy/brat");

  await Reply("Membuat sticker animasi, tunggu sebentar...");

  try {
    // bgColor bisa diganti, contoh "#000000" / "transparent"
    const buffer = await generateATTPWebm(text, "transparent");

    await sock.sendSticker(
      m.chat,
      buffer,
      m,
      { packname: "SilenceVanzxy" }
    );

    useLimit();
  } catch (err) {
    console.error(err);
    return Reply("Error! gagal membuat sticker animasi");
  }
}
break;

case "ttp": {
  if (!cekLimit())
    return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

  if (!text)
    return Reply(`*ex:* ${cmd} halo dunia`);

  const { generateATTPText } = require("SilenceVanzxy/brat");

  await Reply("Membuat sticker teks, tunggu sebentar...");

  try {
    // warna font bisa diganti
    const buffer = generateATTPText(text, "#ffffff");

    await sock.sendSticker(
      m.chat,
      buffer,
      m,
      { packname: "SilenceVanzxy" }
    );

    useLimit();
  } catch (err) {
    console.error(err);
    return Reply("Error! gagal membuat sticker teks");
  }
}
break;

//==================================//

case "brat": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!text) return Reply(`*ex:* ${cmd} haii semuanya`)
const { bratGenerator } = require('SilenceVanzxy/brat');
async function generateHighlightedText() {
  try {
    const imageBuffer = await bratGenerator(text);
    await sock.sendSticker(m.chat, imageBuffer, m, {packname: "SilenceVanzxy"})
    useLimit()
  } catch (error) {
    console.error('Gagal membuat gambar:', error);
    return Reply(`Error! terjadi kesalahan saat membuat sticker`)
  }
}
await Reply("Membuat sticker, tunggu sebentar...")
return generateHighlightedText();
}
break

case "brat2": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!text) return Reply(`*ex:* ${cmd} haii semuanya`)
  try {
  await Reply("Membuat sticker, tunggu sebentar...")
    const imageBuffer = `https://api.serverweb.qzz.io/imagecreator/brat?apikey=skyy&text=${text}`
    await sock.sendSticker(m.chat, imageBuffer, m, {packname: "SilenceVanzxy"})
    useLimit()
  } catch (error) {
    console.error('Gagal membuat gambar:', error);
    return Reply(`Error! terjadi kesalahan saat membuat sticker`)
  }
}
break

//==================================//

case "bratvid2": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply(`*ex:* ${cmd} haii semuanya selamat malam`)
  try {
    await Reply("Membuat sticker, tunggu sebentar...")
    const imageBuffer = `https://api.serverweb.qzz.io/imagecreator/bratvid?apikey=skyy&text=${text}`
    await sock.sendSticker(m.chat, imageBuffer, m, {packname: "SilenceVanzxy"})
    useLimit();
  } catch (e) {
    console.error(e);
    return Reply(`Error! terjadi kesalahan saat membuat sticker`)
  }
}
break;

case "bratvid": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply(`*ex:* ${cmd} haii semuanya selamat malam`)
  try {
    const { bratVidGenerator, generateAnimatedBratVid } = require('SilenceVanzxy/brat');
    const tempDir = "./temp_frames";
    const outputFile = "./brat_animation.webp";
    await Reply("Membuat sticker, tunggu sebentar...")

    // Generate frame animasi
    const frames = await bratVidGenerator(
      text,
      512,
      512,
      "#FFFFFF",
      "#000000",
      [] // highlightWords
    );

    // Buat folder temp
    fs.mkdirSync(tempDir, { recursive: true });

    // Simpan frame
    for (let i = 0; i < frames.length; i++) {
      fs.writeFileSync(
        path.join(tempDir, `frame_${i + 1}.png`),
        frames[i]
      );
    }

    // Gabungkan frame jadi webp animasi
    await generateAnimatedBratVid(tempDir, outputFile);

    // Kirim sticker
    await sock.sendMessage(
      m.chat,
      { sticker: fs.readFileSync(outputFile) },
      { quoted: m }
    );

    // Bersihkan file
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(outputFile);

    useLimit();
  } catch (e) {
    console.error(e);
    return Reply(`Error! terjadi kesalahan saat membuat sticker`)
  }
}
break;

//==================================//

case "tohd":
case "hd":
case "remini": {
    if (!cekLimit())
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    if (!/image/.test(mime))
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`);

    try {
        const axios = require("axios");
        const FormData = require("form-data");
        const fs = require("fs");

        // download image dari chat
        const mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);

        await Reply(`Proses ${command} gambar, tunggu sebentar...`);

        // siapkan form-data
        const formData = new FormData();
        formData.append("apikey", "skyy");
        formData.append("image", fs.createReadStream(mediaPath));

        // kirim ke API upscale
        const res = await axios.post(
            "https://api.serverweb.qzz.io/imagecreator/upscale",
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );

        // hapus file lokal
        fs.unlinkSync(mediaPath);

        const outputUrl = res.data?.result

        if (!outputUrl)
            throw new Error("Output URL tidak ditemukan");

        await sock.sendMessage(
            m.chat,
            {
                image: { url: outputUrl },
                caption: "Berhasil HD Foto ✅",
            },
            { quoted: m }
        );

        useLimit();

    } catch (err) {
        console.error("Remini Error:", err.response?.data || err);
        Reply("Error! terjadi kesalahan saat memproses gambar.");
    }
}
break;

case "tobugil":
case "bugil":
case "telanjang": {
    if (!cekLimit())
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    if (!/image/.test(mime))
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`);

    try {
        const axios = require("axios");
        const FormData = require("form-data");
        const fs = require("fs");

        // download image dari chat
        const mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);

        await Reply(`Proses tobugil gambar, tunggu sebentar...`);

        // siapkan form-data
        const formData = new FormData();
        formData.append("apikey", "skyy");
        formData.append("image", fs.createReadStream(mediaPath));
        formData.append("prompt", "Best quality, hot bikini");

        // kirim ke API upscale
        const res = await axios.post(
            "https://api.serverweb.qzz.io/imagecreator/removeclothes",
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );

        // hapus file lokal
        fs.unlinkSync(mediaPath);

        const outputUrl = res.data?.result

        if (!outputUrl)
            throw new Error("Output URL tidak ditemukan");

        await sock.sendMessage(
            m.chat,
            {
                image: { url: outputUrl },
                caption: "Berhasil Tobugil Foto ✅",
            },
            { quoted: m }
        );

        useLimit();

    } catch (err) {
        console.error("Tobugil Error:", err.response?.data || err);
        Reply("Error! terjadi kesalahan saat memproses gambar.");
    }
}
break;

//==================================//

case "hdvid":
case "tohdvid":
case "hdvidio":
case "hdvideo": {
 if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!/video/.test(mime)) return Reply(`*ex:* ${cmd} dengan kirim atau reply vidio`)
  await Reply(`Processing hd vidio, Tunggu sebentar...`)
  let media = await m.quoted ? await m.quoted.download() : await m.download()
let video = Math.floor(Math.random() * 100) + 1;
  const inputFilePath = `./input${video}.mp4`;
  fs.writeFileSync(inputFilePath, media)
  const outputFilePath = `./output${video}.mp4`;
  const dir = './';
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir)
  }
  const ffmpegCommand = `ffmpeg -i ${inputFilePath} -vf "hqdn3d=1.5:1.5:6:6,unsharp=3:3:0.6,eq=brightness=0.05:contrast=1.1:saturation=1.06" -vcodec libx264 -preset slower -crf 22 -acodec copy -movflags +faststart ${outputFilePath}`;

  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`)
      return Reply(`Error! terjadi kesalahan saat hd vidio.`)
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
    sock.sendMessage(m.chat, { caption: `Berhasil HD Vidio ✅`, video: { url: outputFilePath } }, { quoted: m })
    useLimit()
    fs.unlinkSync(inputFilePath)
    fs.unlinkSync(outputFilePath)
  })
}
break

//==================================//

case "qc": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!text) return Reply(`*ex:* ${cmd} haii namaku riyann`)
let warna = ["#000000", "#ff2414", "#22b4f2", "#eb13f2"]
let ppuser
try {
ppuser = await sock.profilePictureUrl(m.sender, 'image')
} catch (err) {
ppuser = 'https://files.catbox.moe/gqs7oz.jpg'
}
let reswarna = await warna[0]
const obj = {
      "type": "quote",
      "format": "png",
      "backgroundColor": reswarna,
      "width": 512,
      "height": 768,
      "scale": 2,
      "messages": [{
         "entities": [],
         "avatar": true,
         "from": {
            "id": 1,
            "name": m.pushName,
            "photo": {
               "url": ppuser
            }
         },
         "text": text,
         "replyMessage": {}
      }]
   }
   try {
   const json = await axios.post('https://bot.lyo.su/quote/generate', obj, {
      headers: {
         'Content-Type': 'application/json'
      }
   })
   const buffer = Buffer.from(json.data.result.image, 'base64')
   await sock.sendSticker(m.chat, buffer, m, {packname: "SilenceVanzxy"})
   useLimit()
   } catch (error) {
   console.log(error)
   return Reply(error.toString())
   }
}
break

case "iqc": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply("*ex:* .iqc pesannya|jam (contoh: 12:00)")
const { generateIQC } = require('iqc-canvas');
let time = text.split("|")[1]
let pesan = text.split("|")[0]
async function generateHighlightedText() {
  try {
    const imageBuffer = await generateIQC(pesan, time);
    const fill = `./${Date.now()}.jpg`
    const filename = fill
   await fs.writeFileSync(filename, imageBuffer.image)
    await sock.sendMessage(m.chat, { image: fs.readFileSync(filename), caption: "Berhasil membuat IQC ✅" }, { quoted: m })
    useLimit()
  } catch (error) {
    console.error('Gagal membuat gambar:', error);
    return Reply(error.toString())
  }
}
return generateHighlightedText();
}
break

case "iqc2": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  if (!text) return Reply(`*ex:* ${cmd} pesannya`)
    const { generateFakeChatIphone } = require('generator-fake');

async function createFakeChat() {
  try {
    const quoteOptions = {
      text: text,
      chatTime: "21:55",
      statusBarTime: "21:57"
    };
    const quoteBuffer = await generateFakeChatIphone(quoteOptions);
    if (quoteBuffer) {
      await sock.sendMessage(m.chat, { image: Buffer.from(quoteBuffer), caption: "Berhasil membuat IQC ✅" }, { quoted: m });
      useLimit()
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat membuat gambar:", error);
    return Reply(error.toString())
  }
}

return createFakeChat();
}
break;

//==================================//

case "addlist": {
    if (!isOwner) return Reply(mess.owner);
    let key, list;
    if (text.includes("@")) {
        const split = text.split("@");
        key = split[0];
        list = split[1];
    } else {
        key = text;
        list = m.quoted?.text || "";
    }

    if (!key || !list) {
        return Reply(`*ex:* ${cmd} key@list
atau reply teks lalu ketik ${cmd} key`);
    }

    key = key.toLowerCase();
    db.settings.list[key] = {};

    let buffer = null;
    if (/image/.test(mime)) {
        buffer = m.quoted
            ? await m.quoted.download()
            : await m.download();
    }

    if (buffer) {
        const url = await uploadImageBuffer(buffer);
        if (url) db.settings.list[key].image = url;
    }

    db.settings.list[key].response = list;
    let teks = buffer ? `Berhasil menambah list key *${key}* dengan foto.` : `Berhasil menambah list dengan key *${key}*.`
    return Reply(teks);
}
break;

//==================================//

case "list": {
    if (!db.settings.list || Object.keys(db.settings.list).length === 0)
        return Reply("Belum ada list yang tersimpan.")

    const teks = Object.keys(db.settings.list)
        .map((v, i) => `${i + 1}. ${v}`)
        .join("\n")

    return m.reply(`\n*📄 Daftar List Tersimpan:*\n\n${teks}\n`)
}
break

//==================================//

case "dellist": {
    if (!isOwner) return Reply(mess.owner)
    if (!text) return Reply(`*ex:* ${cmd} key`)
    const key = text.toLowerCase()
    if (key.toLowerCase() == "all") {
    db.settings.list = {}
    return Reply(`Berhasil menghapus semua list yang ada di dalam database.`)
    }
    if (!db.settings.list || !db.settings.list[key])
        return Reply(`List dengan key *${key}* tidak ditemukan.`)
    delete db.settings.list[key]
    return Reply(`Berhasil menghapus list dengan key *${key}*`)
}
break

//==================================//

// ===================== CVPS =====================
case "cvps":
case "createvps": {
  if (!isOwner) return Reply(mess.owner)

  const rows = Object.entries(settingVps).map(([key, spec]) => ({
    title: `⚡ ${spec.ram} RAM / ${spec.cpu} / ${spec.disk} Disk`,
    description: `Spec: ${key}`,
    id: `.cvps-spec ${key}`
  }))

  return sock.sendMessage(m.chat, {
    text: `\n🖥️ *Pilih Spesifikasi VPS*\n`,
    buttons: [{
      buttonId: "select_cvps_spec",
      buttonText: { displayText: "⚡ Pilih Spec" },
      type: 4,
      nativeFlowInfo: {
        name: "single_select",
        paramsJson: JSON.stringify({
          title: "Pilih Spesifikasi",
          sections: [{ rows }]
        })
      }
    }],
    headerType: 1,
    viewOnce: true
  }, { quoted: m })
}
break

case "cvps-spec": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return reply("Spec tidak ditemukan!")

  const specKey = text
  if (!settingVps[specKey]) return reply("Spec tidak valid!")

  const rows = Object.entries(vpsImages).map(([key, os]) => ({
    title: `🐧 ${os.name}`,
    description: `OS: ${key}`,
    id: `.cvps-os ${specKey}|${key}`
  }))

  return sock.sendMessage(m.chat, {
    text: `\n🐧 *Pilih OS VPS*\n\nSpec: *${settingVps[specKey].ram} / ${settingVps[specKey].cpu}*\n`,
    buttons: [{
      buttonId: "select_cvps_os",
      buttonText: { displayText: "🐧 Pilih OS" },
      type: 4,
      nativeFlowInfo: {
        name: "single_select",
        paramsJson: JSON.stringify({
          title: "Pilih OS",
          sections: [{ rows }]
        })
      }
    }],
    headerType: 1,
    viewOnce: true
  }, { quoted: m })
}
break


case "cvps-os": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return reply("Data tidak ditemukan!")

  const [specKey, osKey] = text.split("|")
  if (!settingVps[specKey] || !vpsImages[osKey]) return reply("Data tidak valid!")

  const rows = Object.entries(vpsRegions).map(([key, region]) => ({
    title: `🌍 ${region.name}`,
    description: `Region: ${key}`,
    id: `.cvps-region ${specKey}|${osKey}|${key}`
  }))

  return sock.sendMessage(m.chat, {
    text: `\n🌍 *Pilih Region VPS*\n\nSpec: *${settingVps[specKey].ram} / ${settingVps[specKey].cpu}*\nOS: *${vpsImages[osKey].name}*\n`,
    buttons: [{
      buttonId: "select_cvps_region",
      buttonText: { displayText: "🌍 Pilih Region" },
      type: 4,
      nativeFlowInfo: {
        name: "single_select",
        paramsJson: JSON.stringify({
          title: "Pilih Region",
          sections: [{ rows }]
        })
      }
    }],
    headerType: 1,
    viewOnce: true
  }, { quoted: m })
}
break

case "cvps-region": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return reply("Data tidak ditemukan!")

  const [specKey, osKey, regionKey] = text.split("|")
  if (!settingVps[specKey] || !vpsImages[osKey] || !vpsRegions[regionKey]) {
    return reply("Data tidak valid!")
  }

  const spec = settingVps[specKey]
  const os = vpsImages[osKey]
  const region = vpsRegions[regionKey]

  const hostname = `cvps-${generateRandomNumber(100,999)}`

  const teks = `
🖥️ *Konfirmasi Create VPS*

├ Hostname: *${hostname}*
├ Spec: ${spec.ram} / ${spec.cpu} / ${spec.disk}
├ OS: ${os.name}
└ Region: ${region.name} (${regionKey})
`

  return sock.sendMessage(m.chat, {
    buttons: [
      { buttonId: `${prefix}cvps-confirm ${hostname}|${specKey}|${osKey}|${regionKey}`, buttonText: { displayText: "🚀 Create VPS" }, type: 1 }
    ],
    headerType: 1,
    viewOnce: true,
    text: teks
  }, { quoted: m })
}
break

case "cvps-confirm": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return reply("Format salah!")

  const [hostname, specKey, osKey, regionKey] = text.split("|")
  if (!hostname || !settingVps[specKey] || !vpsImages[osKey] || !vpsRegions[regionKey]) {
    return reply("Data tidak valid!")
  }

  try {
    const pw = await generateStrongPassword()
    const pws = pw
    const password = pws

    await reply("🚀 Membuat VPS Digital Ocean... Mohon tunggu ±1-3 menit")

    const dropletId = await createVPSDroplet(
      config.digitalocean.apiKey,
      hostname,
      specKey,
      osKey,
      regionKey,
      password
    )

    const ipAddress = await waitForDropletIP(config.digitalocean.apiKey, dropletId)

    const detail = `
✅ *VPS BERHASIL DIBUAT*

├ Hostname: *${hostname}*
├ IP: *${ipAddress}*
├ Username: *root*
├ Password: *${password}*
├ Droplet ID: *${dropletId}*
├ Region: *${vpsRegions[regionKey].name}*
├ Spec: ${settingVps[specKey].ram} / ${settingVps[specKey].cpu} / ${settingVps[specKey].disk}
└ Dibuat: ${tanggal()}
`

    return sock.sendMessage(m.chat, { text: detail }, { quoted: m })

  } catch (err) {
    console.error(err)
    return reply(`❌ Gagal membuat VPS\n\nError: ${err.message}`)
  }
}
break

//==================================//

case "deldroplet": {
if (!isOwner) return Reply(mess.owner);
if (!text) return Reply(`*ex:* ${cmd} Droplet ID`)
let dropletId = text
let deleteDroplet = async () => {
try {
let response = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
method: 'DELETE',
headers: {
'Content-Type': 'application/json',
'Authorization': `Bearer ${global.apikeyDigitalocean}`
}
});

if (response.ok) {
return Reply('Berhasil Menghapus Droplet ID ${text} ✅');
} else {
const errorData = await response.json();
return Reply(`Gagal menghapus droplet: ${errorData.message}`);
}
} catch (error) {
console.error('Terjadi kesalahan saat menghapus droplet:', error);
return Reply('Terjadi kesalahan saat menghapus droplet.');
}}
return deleteDroplet();
}
break

//==================================//

case 'listdroplet': {
    if (!isOwner) return Reply(mess.owner);
    try {
        const axios = require('axios');
        const getDropletInfo = async () => {
            try {
                const [accountResponse, dropletsResponse] = await Promise.all([
                    axios.get('https://api.digitalocean.com/v2/account', {
                        headers: { Authorization: `Bearer ${global.apikeyDigitalocean}` },
                    }),
                    axios.get('https://api.digitalocean.com/v2/droplets', {
                        headers: { Authorization: `Bearer ${global.apikeyDigitalocean}` },
                    }),
                ]);

                if (accountResponse.status === 200 && dropletsResponse.status === 200) {
                    const dropletLimit = accountResponse.data.account.droplet_limit;
                    const droplets = dropletsResponse.data.droplets || [];
                    const remainingDroplets = dropletLimit - droplets.length;

                    return { dropletLimit, remainingDroplets, droplets };
                } else {
                    return Reply('Gagal mendapatkan data akun atau droplet DigitalOcean!');
                }
            } catch (err) {
                throw err;
            }
        };

        const handleDroplets = async () => {
            try {
                const { dropletLimit, remainingDroplets, droplets } = await getDropletInfo();
                let mesej = `\nSisa droplet yang dapat di pakai: *${remainingDroplets}*\n`;
                mesej += `Total droplet terpakai: *${droplets.length}*\n`;

                if (droplets.length === 0) {
                    mesej += 'Tidak ada droplet yang tersedia!';
                } else {
                    droplets.forEach(droplet => {
                        const ipv4Addresses = droplet.networks.v4.filter(net => net.type === "public");
                        const ipAddress = ipv4Addresses.length > 0 ? ipv4Addresses[0].ip_address : 'Tidak ada IP!';
                        mesej += `\n- *Droplet ID:* ${droplet.id}
- *Hostname:* ${droplet.name}
- *Username:* Root
- *IP Address:* ${ipAddress}
- *Ram:* ${droplet.memory} MB
- *Cpu:* ${droplet.vcpus} CPU
- *OS:* ${droplet.image.distribution}
- *Storage:* ${droplet.disk} GB
- *Status:* ${droplet.status}\n`;
                    });
                }

                sock.sendMessage(m.chat, { text: mesej }, { quoted: m });
            } catch (err) {
                return Reply('Terjadi kesalahan saat mengambil data droplet: ' + err);
            }
        };

        handleDroplets();

    } catch (err) {
        Reply('Terjadi kesalahan: ' + err);
    }
}
break;

//==================================//

case "1gb": case "2gb": case "3gb": case "4gb": case "5gb": 
case "6gb": case "7gb": case "8gb": case "9gb": case "10gb": 
case "unlimited": case "unli": {
    if (!isOwner) {
        return m.reply(mess.owner);
    }
    if (!text) return Reply(`*ex:* ${cmd} username,6283XXX`)

    let nomor, usernem;
    let tek = text.split(",");
    if (tek.includes(",")) {
        let [users, nom] = tek.map(t => t.trim());
        if (!users || !nom) return m.reply(`*ex:* ${cmd} username,6283XXX`)
        nomor = m.mentionedJid[0] ? m.mentionedJid[0] : nom.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        nomor = await sock.toLid(nomor)
        usernem = users.toLowerCase();
    } else {
        usernem = text.toLowerCase();
        nomor = m.isGroup ? m.sender : m.chat
    }
    const resourceMap = {
        "1gb": { ram: "1000", disk: "1000", cpu: "40" },
        "2gb": { ram: "2000", disk: "1000", cpu: "60" },
        "3gb": { ram: "3000", disk: "2000", cpu: "80" },
        "4gb": { ram: "4000", disk: "2000", cpu: "100" },
        "5gb": { ram: "5000", disk: "3000", cpu: "120" },
        "6gb": { ram: "6000", disk: "3000", cpu: "140" },
        "7gb": { ram: "7000", disk: "4000", cpu: "160" },
        "8gb": { ram: "8000", disk: "4000", cpu: "180" },
        "9gb": { ram: "9000", disk: "5000", cpu: "200" },
        "10gb": { ram: "10000", disk: "5000", cpu: "220" },
        "unlimited": { ram: "0", disk: "0", cpu: "0" }
    };
    
    let { ram, disk, cpu } = resourceMap[command] || { ram: "0", disk: "0", cpu: "0" };

    let username = usernem.toLowerCase();
    let email = username + "@gmail.com";
    let name = global.capital(username) + " Server";
    let password = username + "001";

    try {
        let f = await fetch(domain + "/api/application/users", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer " + apikey },
            body: JSON.stringify({ email, username, first_name: name, last_name: "Server", language: "en", password })
        });
        let data = await f.json();
        if (data.errors) return m.reply("Error: " + JSON.stringify(data.errors[0], null, 2));
        let user = data.attributes;

        let f1 = await fetch(domain + `/api/application/nests/${nestid}/eggs/` + egg, {
            method: "GET",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer " + apikey }
        });
        let data2 = await f1.json();
        let startup_cmd = data2.attributes.startup;

        let f2 = await fetch(domain + "/api/application/servers", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer " + apikey },
            body: JSON.stringify({
                name,
                description: global.tanggal(Date.now()),
                user: user.id,
                egg: parseInt(egg),
                docker_image: "ghcr.io/parkervcp/yolks:nodejs_20",
                startup: startup_cmd,
                environment: { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start" },
                limits: { memory: ram, swap: 0, disk, io: 500, cpu },
                feature_limits: { databases: 5, backups: 5, allocations: 5 },
                deploy: { locations: [parseInt(loc)], dedicated_ip: false, port_range: [] },
            })
        });
        let result = await f2.json();
        if (result.errors) return Reply("Error: " + JSON.stringify(result.errors[0], null, 2));
        
        let server = result.attributes;
        var orang = nomor
        if (orang !== m.chat) {
        await Reply(`Berhasil membuat akun panel ✅\ndata panel terkirim ke nomor @${nomor.split("@")[0]}`)
        }

let teks = `
*Behasil Membuat Panel ✅*

📡 *Server ID:* ${server.id}
👤 *Username:* ${user.username}
🔐 *Password:* ${password}
🗓️ *Tanggal:* ${global.tanggal(Date.now())}

*Spesifikasi Server Panel ⚙️*
- RAM: ${ram == "0" ? "Unlimited" : ram / 1000 + "GB"}
- Disk: ${disk == "0" ? "Unlimited" : disk / 1000 + "GB"}
- CPU: ${cpu == "0" ? "Unlimited" : cpu + "%"}
- Panel: ${global.domain}
`

let msg = await generateWAMessageFromContent(orang, {
    viewOnceMessage: {
        message: {
            interactiveMessage: {
                body: { text: teks },
                nativeFlowMessage: {
                    buttons: [
                        { 
                            name: "cta_copy",
                            buttonParamsJson: `{"display_text":"Copy Username","copy_code":"${user.username}"}`
                        },
                        { 
                            name: "cta_copy",
                            buttonParamsJson: `{"display_text":"Copy Password","copy_code":"${password}"}`
                        },
                        { 
                            name: "cta_url",
                            buttonParamsJson: `{"display_text":"Login Panel","url":"${global.domain}"}`
                        }
                    ]
                }, 
                contextInfo: {
                    isForwarded: true
                    }
            }            
        }
    }
}, {});

await sock.relayMessage(orang, msg.message, { messageId: msg.key.id });
    } catch (err) {
        return Reply("Terjadi kesalahan: " + err.message);
    }
}
break

//###############################//

case "delpanel": {
    if (!isOwner) {
        return Reply(mess.owner);
    }
    const rows = []
    rows.push({
title: `Hapus Semua`,
description: `Hapus semua server panel`, 
id: `.delpanel-all`
})            
    try {
        const response = await fetch(`${domain}/api/application/servers`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`,
            },
        });

        const result = await response.json();
        const servers = result.data;

        if (!servers || servers.length === 0) {
            return m.reply("Tidak ada server panel!");
        }

        for (const server of servers) {
            const s = server.attributes;

            const resStatus = await fetch(`${domain}/api/client/servers/${s.uuid.split("-")[0]}/resources`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${capikey}`,
                },
            });

            const statusData = await resStatus.json();

            const ram = s.limits.memory === 0
                ? "Unlimited"
                : s.limits.memory >= 1024
                ? `${Math.floor(s.limits.memory / 1024)} GB`
                : `${s.limits.memory} MB`;

            const disk = s.limits.disk === 0
                ? "Unlimited"
                : s.limits.disk >= 1024
                ? `${Math.floor(s.limits.disk / 1024)} GB`
                : `${s.limits.disk} MB`;

            const cpu = s.limits.cpu === 0
                ? "Unlimited"
                : `${s.limits.cpu}%`;
            rows.push({
title: `${s.name} || ID:${s.id}`,
description: `Ram ${ram} || Disk ${disk} || CPU ${cpu}`, 
id: `.delpanel-response ${s.id}`
})            
        }                  
        await sock.sendMessage(m.chat, {
  buttons: [
    {
    buttonId: 'action',
    buttonText: { displayText: 'ini pesan interactiveMeta' },
    type: 4,
    nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: 'Pilih Server Panel',
          sections: [
            {
              title: `© Powered By ${global.botname}`,
              rows: rows
            }
          ]
        })
      }
      }
  ],
  headerType: 1,
  viewOnce: true,
  text: `\nPilih Server Panel Yang Ingin Dihapus\n`
}, { quoted: m })

    } catch (err) {
        console.error("Error listing panel servers:", err);
        Reply("Terjadi kesalahan saat mengambil data server.");
    }
}
break;

//###############################//

case "delpanel-response": {
    if (!isOwner) return Reply(mess.owner);
    if (!text) return 
    try {
        const serverResponse = await fetch(domain + "/api/application/servers", {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apikey
            }
        });
        const serverData = await serverResponse.json();
        const servers = serverData.data;
        
        let serverName;
        let serverSection;
        let serverFound = false;
        
        for (const server of servers) {
            const serverAttr = server.attributes;
            
            if (Number(text) === serverAttr.id) {
                serverSection = serverAttr.name.toLowerCase();
                serverName = serverAttr.name;
                serverFound = true;
                
                const deleteServerResponse = await fetch(domain + `/api/application/servers/${serverAttr.id}`, {
                    method: "DELETE",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + apikey
                    }
                });
                
                if (!deleteServerResponse.ok) {
                    const errorData = await deleteServerResponse.json();
                    console.error("Gagal menghapus server:", errorData);
                }
                
                break;
            }
        }
        
        if (!serverFound) {
            return Reply("Gagal menghapus server!\nID server tidak ditemukan");
        }
        
        const userResponse = await fetch(domain + "/api/application/users", {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apikey
            }
        });
        const userData = await userResponse.json();
        const users = userData.data;
        
        for (const user of users) {
            const userAttr = user.attributes;
            
            if (userAttr.first_name.toLowerCase() === serverSection) {
                const deleteUserResponse = await fetch(domain + `/api/application/users/${userAttr.id}`, {
                    method: "DELETE",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + apikey
                    }
                });
                
                if (!deleteUserResponse.ok) {
                    const errorData = await deleteUserResponse.json();
                    console.error("Gagal menghapus user:", errorData);
                }
                
                break;
            }
        }
        
        await Reply(`Berhasil Menghapus Sever Panel ✅\n- ID: ${text}\n- Server Name: ${capital(serverName)}`);
        
    } catch (error) {
        console.error("Error dalam proses delpanel:", error);
        await Reply("Terjadi kesalahan saat memproses permintaan");
    }
}
break;

//###############################//

case "delpanel-all": {
if (!isOwner) return Reply(mess.owner)
await Reply(`Memproses penghapusan semua user & server panel yang bukan admin`)
try {
const PTERO_URL = global.domain
const API_KEY = global.apikey
const headers = {
  "Authorization": "Bearer " + API_KEY,
  "Content-Type": "application/json",
  "Accept": "application/json",
};
async function getUsers() {
  try {
    const res = await axios.get(`${PTERO_URL}/api/application/users`, { headers });
    return res.data.data;
  } catch (error) {
    m.reply(JSON.stringify(error.response?.data || error.message, null, 2))
    
    return [];
  }
}

async function getServers() {
  try {
    const res = await axios.get(`${PTERO_URL}/api/application/servers`, { headers });
    return res.data.data;
  } catch (error) {
    m.reply(JSON.stringify(error.response?.data || error.message, null, 2))
    return [];
  }
}

async function deleteServer(serverUUID) {
  try {
    await axios.delete(`${PTERO_URL}/api/application/servers/${serverUUID}`, { headers });
    console.log(`Server ${serverUUID} berhasil dihapus.`);
  } catch (error) {
    console.error(`Gagal menghapus server ${serverUUID}:`, error.response?.data || error.message);
  }
}

async function deleteUser(userID) {
  try {
    await axios.delete(`${PTERO_URL}/api/application/users/${userID}`, { headers });
    console.log(`User ${userID} berhasil dihapus.`);
  } catch (error) {
    console.error(`Gagal menghapus user ${userID}:`, error.response?.data || error.message);
  }
}

async function deleteNonAdminUsersAndServers() {
  const users = await getUsers();
  const servers = await getServers();
  let totalSrv = 0

  for (const user of users) {
    if (user.attributes.root_admin) {
      console.log(`Lewati admin: ${user.attributes.username}`);
      continue; // Lewati admin
    }

    const userID = user.attributes.id;
    const userEmail = user.attributes.email;

    console.log(`Menghapus user: ${user.attributes.username} (${userEmail})`);

    // Cari server yang dimiliki user ini
    const userServers = servers.filter(srv => srv.attributes.user === userID);

    // Hapus semua server user ini
    for (const server of userServers) {
      await deleteServer(server.attributes.id);
      totalSrv += 1
    }
    await deleteUser(userID);
  }
await Reply(`Berhasil menghapus *${totalSrv} user & server* panel yang bukan admin ✅`)
}

return deleteNonAdminUsersAndServers();
} catch (err) {
return Reply(`${JSON.stringify(err, null, 2)}`)
}
}
break

//###############################//

case "listpanel":
case "listserver": {
    if (!isOwner) {
        return Reply(mess.owner);
    }

    try {
        const response = await fetch(`${domain}/api/application/servers`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`,
            },
        });

        const result = await response.json();
        const servers = result.data;

        if (!servers || servers.length === 0) {
            return Reply("Tidak ada server panel.");
        }

        let messageText = `\n Total Server: ${servers.length}\n`

        for (const server of servers) {
            const s = server.attributes;

            const resStatus = await fetch(`${domain}/api/client/servers/${s.uuid.split("-")[0]}/resources`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${capikey}`,
                },
            });

            const statusData = await resStatus.json();

            const ram = s.limits.memory === 0
                ? "Unlimited"
                : s.limits.memory >= 1024
                ? `${Math.floor(s.limits.memory / 1024)} GB`
                : `${s.limits.memory} MB`;

            const disk = s.limits.disk === 0
                ? "Unlimited"
                : s.limits.disk >= 1024
                ? `${Math.floor(s.limits.disk / 1024)} GB`
                : `${s.limits.disk} MB`;

            const cpu = s.limits.cpu === 0
                ? "Unlimited"
                : `${s.limits.cpu}%`;

            messageText += `
- ID: ${s.id}
- Nama Server: ${s.name}
- Ram: ${ram}
- Disk: ${disk}
- CPU: ${cpu}
- Created: ${s.created_at.split("T")[0]}\n`;
        }                  
        await m.reply(messageText)

    } catch (err) {
        console.error("Error listing panel servers:", err);
        Reply("Terjadi kesalahan saat mengambil data server.");
    }
}
break;

//###############################//

case "cadmin": {
    if (!isOwner) return Reply(mess.owner);
    if (!text) return Reply(`*ex:* ${cmd} username,6283XXX`)
    let nomor, usernem;
    const tek = text.split(",");
    if (tek.length > 1) {
        let [users, nom] = tek;
        if (!users || !nom) return Reply(`*ex:* ${cmd} username,6283XXX`)

        nomor = m.mentionedJid[0] ? m.mentionedJid[0] : nom.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        usernem = users.toLowerCase();
        nomor = await sock.toLid(nomor)
    } else {
        usernem = text.toLowerCase();
        nomor = m.isGroup ? m.sender : m.chat;
    }

    const username = usernem.toLowerCase();
    const email = `${username}@gmail.com`;
    const name = global.capital(args[0]);
    const password = `${username}001`;

    try {
        const res = await fetch(`${domain}/api/application/users`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`
            },
            body: JSON.stringify({
                email,
                username,
                first_name: name,
                last_name: "Admin",
                root_admin: true,
                language: "en",
                password
            })
        });

        const data = await res.json();
        if (data.errors) return m.reply(JSON.stringify(data.errors[0], null, 2));

        const user = data.attributes;
        const orang = nomor;

        if (nomor !== m.chat) {
            await Reply(`Berhasil membuat akun admin panel ✅\nData akun terkirim ke @${nomor.split("@")[0]}`);
        }

const teks = `
*Berikut Membuat Admin Panel ✅*

📡 *Server ID:* ${user.id}
👤 *Username:* ${user.username}
🔐 *Password:* ${password}
🗓️ *Tanggal:* ${global.tanggal(Date.now())}
*🌐* ${global.domain}
`;

let msg = generateWAMessageFromContent(orang, {
    viewOnceMessage: {
        message: {
            interactiveMessage: {
                body: { text: teks },
                nativeFlowMessage: {
                    buttons: [
                        { 
                            name: "cta_copy",
                            buttonParamsJson: `{"display_text":"Copy Username","copy_code":"${user.username}"}`
                        },
                        { 
                            name: "cta_copy",
                            buttonParamsJson: `{"display_text":"Copy Password","copy_code":"${password}"}`
                        },
                        { 
                            name: "cta_url",
                            buttonParamsJson: `{"display_text":"Login Panel","url":"${global.domain}"}`
                        }
                    ]
                }, 
                contextInfo: {
                    isForwarded: true
                }
            }
        }
    }
}, {});

await sock.relayMessage(orang, msg.message, { messageId: msg.key.id });
    } catch (err) {
        console.error(err);
        Reply("Terjadi kesalahan saat membuat akun admin panel.");
    }
}
break;

//###############################//

case "deladmin": {
    if (!isOwner) return Reply(mess.owner);
    try {
        const res = await fetch(`${domain}/api/application/users`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`
            }
        });
        const rows = []
        const data = await res.json();
        const users = data.data;

        const adminUsers = users.filter(u => u.attributes.root_admin === true);
        if (adminUsers.length < 1) return Reply("Tidak ada admin panel.");

        let teks = `\nTotal Admin: ${adminUsers.length}\n`
        adminUsers.forEach((admin, idx) => {
            teks += `
- ID: ${admin.attributes.id}
- Nama: ${admin.attributes.first_name}
- Created: ${admin.attributes.created_at.split("T")[0]}
`;
rows.push({
title: `${admin.attributes.first_name} || ID:${admin.attributes.id}`,
description: `Created At: ${admin.attributes.created_at.split("T")[0]}`, 
id: `.deladmin-response ${admin.attributes.id}`
})            
        });

        await sock.sendMessage(m.chat, {
  buttons: [
    {
    buttonId: 'action',
    buttonText: { displayText: 'ini pesan interactiveMeta' },
    type: 4,
    nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: 'Pilih Admin Panel',
          sections: [
            {
              title: `© Powered By ${global.botname}`,
              rows: rows
            }
          ]
        })
      }
      }
  ],
  headerType: 1,
  viewOnce: true,
  text: `\nPilih Admin Panel Yang Ingin Dihapus\n`
}, { quoted: m })

    } catch (err) {
        console.error(err);
        Reply("Terjadi kesalahan saat mengambil data admin.");
    }
}
break;

//###############################//

case "deladmin-response": {
    if (!isOwner) return Reply(mess.owner);
    if (!text) return 
    try {
        const res = await fetch(`${domain}/api/application/users`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`
            }
        });

        const data = await res.json();
        const users = data.data;

        let targetAdmin = users.find(
            (e) => e.attributes.id == args[0] && e.attributes.root_admin === true
        );

        if (!targetAdmin) {
            return Reply("Gagal menghapus akun!\nID user tidak ditemukan");
        }

        const idadmin = targetAdmin.attributes.id;
        const username = targetAdmin.attributes.username;

        const delRes = await fetch(`${domain}/api/application/users/${idadmin}`, {
            method: "DELETE",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`
            }
        });

        if (!delRes.ok) {
            const errData = await delRes.json();
            return Reply(`Gagal menghapus akun admin!\n${JSON.stringify(errData.errors[0], null, 2)}`);
        }

        await Reply(`Berhasil Menghapus Admin Panel ✅\n- ID: ${text}\n- Nama: ${global.capital(username)}`);

    } catch (err) {
        console.error(err);
        Reply("Terjadi kesalahan saat menghapus akun admin.");
    }
}
break;

//###############################//

case "listadmin": {
    if (!isOwner) return Reply(mess.owner);

    try {
        const res = await fetch(`${domain}/api/application/users`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${apikey}`
            }
        });

        const data = await res.json();
        const users = data.data;

        const adminUsers = users.filter(u => u.attributes.root_admin === true);
        if (adminUsers.length < 1) return Reply("Tidak ada admin panel.");

        let teks = `\n Total Admin: ${adminUsers.length}\n`
        adminUsers.forEach((admin, idx) => {
            teks += `
- ID: ${admin.attributes.id}
- Nama: ${admin.attributes.first_name}
- Created: ${admin.attributes.created_at.split("T")[0]}
`;
        });

        await m.reply(teks)

    } catch (err) {
        console.error(err);
        Reply("Terjadi kesalahan saat mengambil data admin.");
    }
}
break;

//==================================//

case "uninstallpanel": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return Reply(`*ex:* ${cmd} ipvps|pwvps`)

  let t = text.split("|")
  if (t.length < 2) return Reply(`*ex:* ${cmd} ipvps|pwvps`)

  const { Client: SSHClient } = require("ssh2")
  const net = require("net")

  let [ipvps, passwd] = t
  const connSettings = {
    host: ipvps,
    port: 22,
    username: "root",
    password: passwd
  }

  async function waitForSSH(host, port = 22, timeout = 300) {
    return new Promise((resolve, reject) => {
      let elapsed = 0
      const interval = setInterval(() => {
        const socket = new net.Socket()
        socket.setTimeout(2000)
        socket.on("connect", () => {
          clearInterval(interval)
          socket.destroy()
          resolve(true)
        })
        socket.on("error", () => socket.destroy())
        socket.on("timeout", () => socket.destroy())
        socket.connect(port, host)

        elapsed += 2
        if (elapsed >= timeout) {
          clearInterval(interval)
          reject(new Error("VPS tidak merespon SSH setelah reboot"))
        }
      }, 2000)
    })
  }

  const ssh = new SSHClient()

  ssh.on("ready", async () => {
    try {
      // 1️⃣ Restart VPS dulu
      await new Promise((res, rej) => {
        ssh.exec("sudo reboot", (err, stream) => {
          if (err) return rej(err)
          stream.on("close", () => res())
            .on("data", () => {})
            .stderr.on("data", () => {})
        })
      })
      ssh.end()
      await m.reply("♻️ VPS direstart, menunggu aktif kembali...")

      // 2️⃣ Tunggu VPS aktif lagi
      await waitForSSH(ipvps)
      await m.reply("✅ VPS sudah aktif kembali, menjalankan uninstall panel + cleardb...")

      // 3️⃣ SSH baru untuk uninstall panel + cleardb
      const ssh2 = new SSHClient()
      ssh2.on("ready", () => {

        const uninstallCommand = `bash <(curl -s https://pterodactyl-installer.se)`
        const cleardbCommand = `
sudo dpkg --configure -a
sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y mariadb-server mariadb-client mariadb-common mysql-common mysql-server-core-* mysql-client-core-*
sudo apt-get autoremove -y
sudo rm -rf /var/lib/mysql /etc/mysql
echo "✅ Panel dan Database MySQL/MariaDB berhasil dibersihkan!"
sudo reboot
`.trim()

        ssh2.exec(uninstallCommand, { pty: true }, (err, stream) => {
          if (err) return m.reply("❌ Gagal menjalankan uninstall panel")

          stream.on("close", () => {
            // Setelah uninstall panel, jalankan cleardb
            ssh2.exec(cleardbCommand, { pty: true }, (err, stream2) => {
              if (err) return m.reply("❌ Gagal menjalankan cleardb")

              stream2.on("close", async (code) => {
                if (code === 0) {
                  await m.reply("✅ Uninstall panel + Cleardb selesai!")
                } else {
                  await m.reply("⚠ Terjadi error saat menjalankan cleardb.")
                }
                ssh2.end()
              }).on("data", data => {
                console.log("OUTPUT cleardb:", data.toString())
              }).stderr.on("data", data => {
                console.log("STDERR cleardb:", data.toString())
              })
            })
          }).on("data", (data) => {
            const out = data.toString()
            console.log("OUTPUT uninstall:", out)

            // Automasi input prompt installer
            if (out.includes('Input 0-6')) stream.write("6\n")
            if (out.includes('(y/N)')) stream.write("y\n")
            if (out.includes('Choose the panel user')) stream.write("\n")
            if (out.includes('Choose the panel database')) stream.write("\n")
          }).stderr.on("data", (data) => {
            console.log("STDERR uninstall:", data.toString())
          })
        })

      }).on("error", async err => {
        await m.reply(`❌ Gagal SSH setelah reboot: ${err.message}`)
      }).connect(connSettings)

    } catch (e) {
      await m.reply(`❌ Error: ${e.message}`)
    }
  }).on("error", async err => {
    await m.reply(`❌ Gagal terhubung ke VPS: ${err.message}`)
  }).connect(connSettings)
}
break

//==================================//

case "installpanel": {
    if (!isOwner) return Reply(mess.owner)
    if (!text) return Reply("*ex:* .instalpanel ipvps|pwvps|panel.com|node.com|ramserver (contoh 100000)");
    
    let vii = text.split("|");
    if (vii.length < 5) return Reply(mess.owner)
    if (!text) return Reply("*ex:* .instalpanel ipvps|pwvps|panel.com|node.com|ramserver (contoh 100000)");
    
    const ssh2 = require("ssh2");
    const ress = new ssh2.Client();
    const connSettings = {
        host: vii[0],
        port: '22',
        username: 'root',
        password: vii[1]
    };
    
    const jids = m.chat
    const pass = "admin001";
    let passwordPanel = pass;
    const domainpanel = vii[2];
    const domainnode = vii[3];
    const ramserver = vii[4];
    const deletemysql = `\n`;
    const commandPanel = `bash <(curl -s https://pterodactyl-installer.se)`;
    const commandStartWings = `.startwings ${vii[0]}|${vii[1]}|token`
    
    async function instalWings() {
    ress.exec(commandPanel, async (err, stream) => {
        if (err) {
            console.error('Wings installation error:', err);
            Reply(`Gagal memulai instalasi Wings: ${err.message}`);
            return ress.end();
        }
        
        stream.on('close', async (code, signal) => {
            await InstallNodes()            
        }).on('data', async (data) => {
            const dataStr = data.toString();
            console.log('Wings Install: ' + dataStr);
            
            if (dataStr.includes('Input 0-6')) {
                stream.write('1\n');
            }
            else if (dataStr.includes('(y/N)')) {
                stream.write('y\n');
            }
            else if (dataStr.includes('Enter the panel address (blank for any address)')) {
                stream.write(`${domainpanel}\n`);
            }
            else if (dataStr.includes('Database host username (pterodactyluser)')) {
                stream.write('admin\n');
            }
            else if (dataStr.includes('Database host password')) {
                stream.write('admin\n');
            }
            else if (dataStr.includes('Set the FQDN to use for Let\'s Encrypt (node.example.com)')) {
                stream.write(`${domainnode}\n`);
            }
            else if (dataStr.includes('Enter email address for Let\'s Encrypt')) {
                stream.write('admin@gmail.com\n');
            }
        }).stderr.on('data', async (data) => {
            console.error('Wings Install Error: ' + data);
            Reply(`Error pada instalasi Wings:\n${data}`);
        });
    });
}

    async function InstallNodes() {
        ress.exec('bash <(curl -s https://raw.githubusercontent.com/SkyzoOffc/Pterodactyl-Theme-Autoinstaller/main/createnode.sh)', async (err, stream) => {
            if (err) throw err;
            
            stream.on('close', async (code, signal) => {
                
    let teks = `
*Install Panel Telah Berhasil ✅*

*Berikut Detail Akun Panel Kamu 📦*

*👤 Username :* admin
🔐 Password : \`${passwordPanel}\`
🌐 ${domainpanel}

Silahkan setting allocation & ambil token node di node yang sudah dibuat oleh bot.

*Cara menjalankan wings :*
\`.startwings ipvps|pwvps|tokennode\`
    `;

    let msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: teks },
                    nativeFlowMessage: {
                        buttons: [
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Username","copy_code":"admin"}`
                            },
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Password","copy_code":"${passwordPanel}"}`
                            },
                            { 
                                name: "cta_url",
                                buttonParamsJson: `{"display_text":"Login Panel","url":"https://${domainpanel}"}`
                            }, 
                                                        { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Cmd Start Wings","copy_code":"${commandStartWings}"}`
                            },
                        ]
                    }, 
                    contextInfo: {
                    isForwarded: true
                    }
                }
            }
        }
    }, {});

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
                
                ress.end();
            }).on('data', async (data) => {
                await console.log(data.toString());
                if (data.toString().includes("Masukkan nama lokasi: ")) {
                    stream.write('Singapore\n');
                }
                if (data.toString().includes("Masukkan deskripsi lokasi: ")) {
                    stream.write('Node By Skyzo\n');
                }
                if (data.toString().includes("Masukkan domain: ")) {
                    stream.write(`${domainnode}\n`);
                }
                if (data.toString().includes("Masukkan nama node: ")) {
                    stream.write('SilenceVanzxy\n');
                }
                if (data.toString().includes("Masukkan RAM (dalam MB): ")) {
                    stream.write(`${ramserver}\n`);
                }
                if (data.toString().includes("Masukkan jumlah maksimum disk space (dalam MB): ")) {
                    stream.write(`${ramserver}\n`);
                }
                if (data.toString().includes("Masukkan Locid: ")) {
                    stream.write('1\n');
                }
            }).stderr.on('data', async (data) => {
                console.log('Stderr : ' + data);
                Reply(`Error pada instalasi Wings: ${data}`);
            });
        });
    }

    async function instalPanel() {
        ress.exec(commandPanel, (err, stream) => {
            if (err) throw err;
            
            stream.on('close', async (code, signal) => {
                await instalWings();
            }).on('data', async (data) => {
                if (data.toString().includes('Input 0-6')) {
                    stream.write('0\n');
                } 
                if (data.toString().includes('(y/N)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('Database name (panel)')) {
                    stream.write('\n');
                }
                if (data.toString().includes('Database username (pterodactyl)')) {
                    stream.write('admin\n');
                }
                if (data.toString().includes('Password (press enter to use randomly generated password)')) {
                    stream.write('admin\n');
                } 
                if (data.toString().includes('Select timezone [Europe/Stockholm]')) {
                    stream.write('Asia/Jakarta\n');
                } 
                if (data.toString().includes('Provide the email address that will be used to configure Let\'s Encrypt and Pterodactyl')) {
                    stream.write('admin@gmail.com\n');
                } 
                if (data.toString().includes('Email address for the initial admin account')) {
                    stream.write('admin@gmail.com\n');
                } 
                if (data.toString().includes('Username for the initial admin account')) {
                    stream.write('admin\n');
                } 
                if (data.toString().includes('First name for the initial admin account')) {
                    stream.write('admin\n');
                } 
                if (data.toString().includes('Last name for the initial admin account')) {
                    stream.write('admin\n');
                } 
                if (data.toString().includes('Password for the initial admin account')) {
                    stream.write(`${passwordPanel}\n`);
                } 
                if (data.toString().includes('Set the FQDN of this panel (panel.example.com)')) {
                    stream.write(`${domainpanel}\n`);
                } 
                if (data.toString().includes('Do you want to automatically configure UFW (firewall)')) {
                    stream.write('y\n')
                } 
                if (data.toString().includes('Do you want to automatically configure HTTPS using Let\'s Encrypt? (y/N)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('Select the appropriate number [1-2] then [enter] (press \'c\' to cancel)')) {
                    stream.write('1\n');
                } 
                if (data.toString().includes('I agree that this HTTPS request is performed (y/N)')) {
                    stream.write('y\n');
                }
                if (data.toString().includes('Proceed anyways (your install will be broken if you do not know what you are doing)? (y/N)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('(yes/no)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('Initial configuration completed. Continue with installation? (y/N)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('Still assume SSL? (y/N)')) {
                    stream.write('y\n');
                } 
                if (data.toString().includes('Please read the Terms of Service')) {
                    stream.write('y\n');
                }
                if (data.toString().includes('(A)gree/(C)ancel:')) {
                    stream.write('A\n');
                } 
                console.log('Logger: ' + data.toString());
            }).stderr.on('data', (data) => {
                Reply(`Error Terjadi kesalahan :\n${data}`);
                console.log('STDERR: ' + data);
            });
        });
    }

    ress.on('ready', async () => {
        await Reply(`Memproses Installasi Panel 🚀\n\n` +
                     `- IP Address: ${vii[0]}\n` +
                     `- Domain: ${domainpanel}\n\n` +
                     `Mohon Tunggu 1-10 Menit Hingga Proses Install Selesai`);
        
        ress.exec(deletemysql, async (err, stream) => {
            if (err) throw err;
            
            stream.on('close', async (code, signal) => {
                await instalPanel();
            }).on('data', async (data) => {
                await stream.write('\t');
                await stream.write('\n');
                await console.log(data.toString());
            }).stderr.on('data', async (data) => {
                Reply(`Error Terjadi kesalahan :\n${data}`);
                console.log('Stderr : ' + data);
            });
        });
    });

    ress.on('error', (err) => {
        console.error('SSH Connection Error:', err);
        Reply(`Gagal terhubung ke server: ${err.message}`);
    });
    ress.connect(connSettings);
}
break

//###############################//

case "startwings":
case "configurewings": {
    if (!isOwner) return Reply(mess.owner)
    let t = text.split('|');
    if (t.length < 3) return Reply("*ex:* .startwings ipvps|pwvps|token");
    if (!text) return Reply("*ex:* .startwings ipvps|pwvps|token");
    let ipvps = t[0].trim();
    let passwd = t[1].trim();
    let token = t[2].trim();
    const connSettings = {
        host: ipvps,
        port: 22,
        username: 'root',
        password: passwd
    };
    const command = `${token} && systemctl start wings`;
    const ssh2 = require("ssh2");
    const ress = new ssh2.Client();
    ress.on('ready', () => {
        ress.exec(command, (err, stream) => {
            if (err) {
                Reply('Gagal menjalankan perintah di VPS');
                ress.end();
                return;
            }

            stream.on('close', async (code, signal) => {
                await Reply("Berhasil Menjalankan Wings Node Panel Pterodactyl ✅");
                ress.end();
            }).on('data', (data) => {
                console.log("STDOUT:", data.toString());
                                // Opsi jika perlu input interaktif
                stream.write("y\n");
                stream.write("systemctl start wings\n");
            }).stderr.on('data', (data) => {
                console.log("STDERR:", data.toString());
                reply('Terjadi error saat eksekusi:\n' + data.toString());
            });
        });
    }).on('error', (err) => {
        console.log('Connection Error:', err.message);
        Reply('Gagal terhubung ke VPS: IP atau password salah.');
    }).connect(connSettings);
}
break;


case "subdo":
case "subdomain": {
    if (!isOwner) return Reply(mess.owner);
    if (!text.includes("|")) return Reply(`*ex:* ${cmd} hostname|ipvps`);

    const obj = Object.keys(subdomain);
    if (obj.length < 1) return Reply("Tidak ada API Domain yang tersedia.");

    const hostname = text.split("|")[0].toLowerCase();
    const ip = text.split("|")[1];
    const rows = obj.map((domain, index) => ({
        title: `🌐 ${domain}`,
        description: `Result: https://${hostname}.${domain}`,
        id: `.subdomain-response ${index + 1} ${hostname.trim()}|${ip}`
    }));

    await sock.sendMessage(m.chat, {
        buttons: [
            {
                buttonId: 'action',
                buttonText: { displayText: 'ini pesan interactiveMeta' },
                type: 4,
                nativeFlowInfo: {
                    name: 'single_select',
                    paramsJson: JSON.stringify({
                        title: 'Pilih Domain',
                        sections: [
                            {
                                title: `© Powered By ${global.botname}`,
                                rows: rows
                            }
                        ]
                    })
                }
            }
        ],
        headerType: 1,
        viewOnce: true,
        text: `\nPilih Domain Server Yang Tersedia\nTotal Domain: ${obj.length}\n`
    }, { quoted: m });
}
break;

//==================================//

case "subdomain-response": { 
    if (!isOwner) return Reply(mess.owner);
    if (!text) return;

    if (!args[0] || isNaN(args[0])) return Reply("Domain tidak ditemukan!");
    const dom = Object.keys(subdomain);
    const domainIndex = Number(args[0]) - 1;
    if (domainIndex >= dom.length || domainIndex < 0) return Reply("Domain tidak ditemukan!");

    if (!args[1] || !args[1].includes("|")) return Reply("Hostname/IP Tidak ditemukan!");

    let tldnya = dom[domainIndex];
    const [host, ip] = args[1].split("|").map(str => str.trim());

    async function subDomain1(host, ip) {
        return new Promise((resolve) => {
            axios.post(
                `https://api.cloudflare.com/client/v4/zones/${subdomain[tldnya].zone}/dns_records`,
                {
                    type: "A",
                    name: `${host.replace(/[^a-z0-9.-]/gi, "")}.${tldnya}`,
                    content: ip.replace(/[^0-9.]/gi, ""),
                    ttl: 3600,
                    priority: 10,
                    proxied: false,
                },
                {
                    headers: {
                        Authorization: `Bearer ${subdomain[tldnya].apitoken}`,
                        "Content-Type": "application/json",
                    },
                }
            ).then(response => {
                let res = response.data;
                if (res.success) {
                    resolve({ success: true, name: res.result?.name, ip: res.result?.content });
                } else {
                    resolve({ success: false, error: "Gagal membuat subdomain." });
                }
            }).catch(error => {
                let errorMsg = error.response?.data?.errors?.[0]?.message || error.message || "Terjadi kesalahan!";
                resolve({ success: false, error: errorMsg });
            });
        });
    }

    const domnode = `node${getRandom("")}.${host}`;
    let panelDomain = "";
    let nodeDomain = "";

    for (let i = 0; i < 2; i++) {
        let subHost = i === 0 ? host.toLowerCase() : domnode;
        try {
            let result = await subDomain1(subHost, ip);
            if (result.success) {
                if (i === 0) panelDomain = result.name;
                else nodeDomain = result.name;
            } else {
                return m.reply(result.error);
            }
        } catch (err) {
            return Reply("Error: " + err.message);
        }
    }

    let teks = `
Subdomain Berhasil Dibuat ✅

- IP: ${ip}
- Panel: ${panelDomain}
- Node: ${nodeDomain}
`;

    let msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: teks },
                    nativeFlowMessage: {
                        buttons: [
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Subdomain Panel","copy_code":"${panelDomain}"}`
                            },
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Subdomain Node","copy_code":"${nodeDomain}"}`
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break;

//==================================//

case "done":
case "don":
case "proses":
case "ps": {
    if (!isOwner) return Reply(mess.owner);
    if (!text) return Reply(`*ex:* ${cmd} nama barang`);
    const status = /done|don/.test(command) ? "Transaksi Done ✅" : "Dana Telah Diterima ✅";
    const teks = `${status}
    
📦 Pembelian: ${text}
🗓️ Tanggal: ${global.tanggal(Date.now())}

📢 Cek Testimoni Pembeli:
${global.linkchannel || "-"}

📣 Gabung Grup Share & Promosi:
${global.linkgrup || "-"}`;

await sock.sendMessage(m.chat, { text: teks, contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: {
newsletterJid: global.idchannel,
newsletterName: `Creator: @${global.ownername}`, 
serverId: 200
}}})
}
break;

//==================================//

case "pay": case "payment": {
let teks = `
*List Payment SilenceVanzxy 🕊️*

*∘ Dana:* ${global.dana}
*∘ Ovo:* ${global.ovo}
*∘ Gopay:* ${global.gopay}
*∘ QRIS:* ${global.qris}

_Wajib kirimkan bukti ss transfer, demi keamanan bersama!_
`
try {
await sock.sendMessage(m.chat, { image: { url: global.qris }, caption: teks, contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: {
newsletterJid: global.idchannel,
newsletterName: `Creator: @${global.ownername}`, 
serverId: 200
}}})
} catch (err) {
await sock.sendMessage(m.chat, { text: teks, contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: {
newsletterJid: global.idchannel,
newsletterName: `Creator: @${global.ownername}`, 
serverId: 200
}}})
}
}
break

//==================================//

case "setthumb":
case "setimg":
case "setthumbnail": {
    if (!isOwner) return Reply(mess.owner)
    if (!/image/.test(mime)) return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    let buffer = m.quoted ? await m.quoted.download() : await m.download();        
        let directLink = await uploadImageBuffer(buffer);
    let url = directLink
    if (!url || !url.startsWith("http")) return Reply("Gagal upload url thumbnail.");
    try {
        let settingPath = "./config.js";
        let file = fs.readFileSync(settingPath, "utf8");
        let updated = file.replace(
            /global\.thumb\s*=\s*['"].*?['"]/,
            `global.thumb = "${url}"`
        );
        global.thumb = url
        delete global.imageMenu
        fs.writeFileSync(settingPath, updated);
    } catch (err) {
        console.error(err);
    }
    return Reply("Thumbnail menu berhasil diganti ✅");
}
break;

//==================================//


case "setthumb2":
case "setimg2":
case "setthumbnail2": {
    if (!isOwner) return Reply(mess.owner)
    if (!/image/.test(mime)) return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    let buffer = m.quoted ? await m.quoted.download() : await m.download();        
        let directLink = await uploadImageBuffer(buffer);
    let url = directLink
    if (!url || !url.startsWith("http")) return Reply("Gagal upload url thumbnail.");
    try {
        let settingPath = "./config.js";
        let file = fs.readFileSync(settingPath, "utf8");
        let updated = file.replace(
            /global\.thumbnailReply\s*=\s*['"].*?['"]/,
            `global.thumbnailReply = "${url}"`
        );
        fs.writeFileSync(settingPath, updated);
    } catch (err) {
        console.error(err);
    }
    return Reply("Thumbnail reply berhasil diganti ✅");
}
break;

//==================================//

case "botstatus": case "status": case "statusbot": {
if (!isOwner) return Reply(mess.owner)
let status = (yes) => {
return yes ? "*aktif ✅*" : "*tidak aktif ❌*"
}
let teks = `
- Autoread: ${status(db?.settings?.autoread)}
- Group Only: ${status(db?.settings?.grouponly)}
- Pc Only: ${status(db?.settings?.pconly)}
- Mode Sewa: ${status(db?.settings?.modesewa)}
`
return Reply(teks)
}
break

//==================================//

case "listsewa": {
    if (!isOwner) return Reply(mess.owner);
    const data = db.groups;
    const keys = Object.keys(data);
    if (keys.length === 0) {
        return Reply("Belum ada grup yang menyewa bot.");
    }
    let teks = "";
    let count = 0;
    for (let id of keys) {
        let g = data[id];
        if (!g.sewa || !g.sewaTime) continue;
        count++;
        const now = Date.now();
        const sisa = g.sewaTime - now;
        let days = Math.floor(sisa / (24 * 60 * 60 * 1000));
        let hours = Math.floor((sisa % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        let minutes = Math.floor((sisa % (60 * 60 * 1000)) / (60 * 1000));
        const expiredDate = new Date(g.sewaTime).toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        teks +=
`
- Grup Name: ${g.groupName || "Tidak diketahui"}
- Group ID: ${id}
- Expired: ${expiredDate}
- Sisa: ${days} hari ${hours} jam ${minutes} menit
`;
    }
    if (count === 0) return Reply("Tidak ada grup yang sedang menyewa bot.");
    let teks2 = `\n  Total Grup Sewa: ${count}\n` + teks
    m.reply(teks2);
}
break;

case "addsewa": {
    if (!isOwner) return Reply(mess.owner);
    if (!m.isGroup) return Reply(mess.group)
    if (!text) return Reply(`*ex:* ${cmd} 5d\nd = hari, h = jam, m = menit`);
    const res = await addSewa(m.chat, text, db, m);
    Reply(res.message);
}
break;

case "ceksewa": {
    if (!m.isGroup) return Reply(mess.group)
    const result = await cekSewa(m.chat, db);
    Reply(result);
}
break;

case "delsewa": {
    if (!isOwner) return Reply(mess.owner);
    if (!m.isGroup) return Reply(mess.group)
    const result = await delSewa(m.chat, db);
    Reply(result);
}
break;

//==================================//

case "resetdb": {
    if (!isOwner) return Reply(mess.owner);
    await sock.sendMessage(m.chat, {
        text: `⚠️ *Konfirmasi Reset Database*\n\nApakah kamu yakin ingin mereset seluruh database user & settingan bot ke default?\n\nTindakan ini *tidak bisa dibatalkan*!`,
        buttons: [
            {
                buttonId: ".resetdb_yes",
                buttonText: { displayText: "Ya, Reset Sekarang" },
                type: 1
            },
            {
                buttonId: ".resetdb_no",
                buttonText: { displayText: "Tidak, Batalkan" },
                type: 1
            }
        ],
        headerType: 1,
        viewOnce: true
    }, { quoted: m });
}
break;

case "resetdb_yes": {
    if (!isOwner) return Reply(mess.owner);
    global.db = {};
    return Reply("✅ Database berhasil di reset ke default");
}
break;

case "resetdb_no": {
    if (!isOwner) return Reply(mess.owner);
    return Reply("❌ Reset database dibatalkan.");
}
break;

//==================================//

case "bljpm": case "bl": {
if (!isOwner) return Reply(mess.owner);
if (!text) {
let rows = []
const a = await sock.groupFetchAllParticipating()
if (a.length < 1) return Reply("Tidak ada grup chat.")
const Data = Object.values(a)
let number = 0
for (let u of Data) {
const name = u.subject || "Unknown"
rows.push({
title: name,
description: `ID - ${u.id}`, 
id: `.bljpm ${u.id}|${name}`
})
}
return sock.sendMessage(m.chat, {
  buttons: [
    {
    buttonId: 'action',
    buttonText: { displayText: 'ini pesan interactiveMeta' },
    type: 4,
    nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: 'Pilih Grup',
          sections: [
            {
              title: `Pilih Salah Satu Grup Chat`,
              rows: rows
            }
          ]
        })
      }
      }
  ],
  headerType: 1,
  viewOnce: true,
  text: `\nPilih Salah Satu Grup Chat\n`
}, { quoted: m })
}
let [id, name] = text.split("|")
if (!id || !name) return
if (db.settings.bljpm.includes(id)) return Reply(`Grup *${name}* sudah terdaftar dalam data Blacklist Jpm!`)
db.settings.bljpm.push(id)
return Reply(`Grup *${name}* Berhasil ditambahkan kedalam data Blacklist Jpm.`)
}
break

//==================================//

case "afk": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)
    let user = db.users[m.sender]
    if (!user) db.users[m.sender] = { afk: { status: false, reason: "", afkTime: 0 } }

    let reason = text ? text : (m.quoted?.text || "Tanpa alasan")
    user.afk = {
        status: true,
        reason,
        afkTime: Date.now()
    }
    Reply(`@${m.sender.split("@")[0]} telah melakukan AFK\n*Alasan:* ${reason}`)
    useLimit()
}
break

//==================================//

case "rvo": case "readviewonce": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
if (!m.quoted) return Reply(`Balas pesan sekali lihat dengan ketik *${cmd}*`)
let msg = m.quoted.message || m.quoted
if (!msg.viewOnce && m.quoted.mtype !== "viewOnceMessageV2") return Reply("Pesan itu bukan sekali lihat!")
    let mesages = msg?.videoMessage || msg?.imageMessage || msg?.audioMessage || msg
    let type = mesages.mimetype.split("/")[0]
let media = await downloadContentFromMessage(mesages, type)
    let buffer = Buffer.from([])
    for await (const chunk of media) {
        buffer = Buffer.concat([buffer, chunk])
    }
    const cap = mesages?.caption ? `*Caption:* ${mesages.caption}` : ""
    if (/video/.test(type)) {
        await sock.sendMessage(m.chat, {video: buffer, caption: cap}, {quoted: m})
    } else if (/image/.test(type)) {
        await sock.sendMessage(m.chat, {image: buffer, caption: cap}, {quoted: m})
    } else if (/audio/.test(type)) {
        await sock.sendMessage(m.chat, {audio: buffer, mimetype: "audio/mpeg", ptt: true}, {quoted: m})
    }
    useLimit()
}
break

//==================================//

case "emojimix": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} 😂<spasi>🤮`);
    try {
        let [emoji1, emoji2] = text.split(" ");
        if (!emoji1 || !emoji2) return Reply(`*ex:* ${cmd} 😂<spasi>🤮`);
        const urlApi = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
        const json = await fetch(urlApi).then(res => res.json());
        const url = json?.results?.[0]?.url;
        if (!url) return Reply("Gagal mendapatkan hasil emoji mix.");
        const buffer = await getBuffer(url);
        await sock.sendSticker(m.chat, buffer, m, {packname: "SilenceVanzxy"})
        useLimit()
    } catch (err) {
        console.error(err);
        Reply("Terjadi kesalahan saat memproses emoji mix.");
    }
}
break;

//==================================//

case "emojitogif": case "togif": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!text) return Reply(`*ex:* ${cmd} 🥰`);
    function encodeEmoji(emoji) {
  return [...emoji].map(char => char.codePointAt(0).toString(16)).join('-');
    }
    try {
        const emoji = text.trim();
        const code = encodeEmoji(emoji);
        const url = `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.webp`;
        const buffer = await getBuffer(url);
        await sock.sendSticker(m.chat, buffer, m, {packname: "SilenceVanzxy"})
    useLimit()
    } catch (e) {
        console.error(e);
        Reply("Emoji tidak ditemukan atau gagal mengambil GIF.");
    }
}
break;

//==================================//

case "enc": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  const jsconfuser = await import("js-confuser");
  if (!m.quoted) return Reply("*ex:* .enc dengan reply file .js");
  const obj = m.quoted?.message || m.quoted
  const filename = obj?.documentMessage?.fileName || obj?.fileName || null
  if (!filename || !filename.includes(".js")) return Reply("*ex:* .enc dengan reply file .js");
  await Reply(`🔒 Sedang memproses encrypt ${filename}...`);
  try {
    const buffer = await m.quoted.download();
    if (!buffer) return Reply("Gagal download file!");
    const inputCode = buffer.toString();
    const encrypted = await jsconfuser.obfuscate(inputCode, {
      target: "node",
      preset: "high",
      stringEncoding: true,
      identifierGenerator: "zeroWidth",
    });

    const outPath = `./sampah/${filename}`;
    fs.writeFileSync(outPath, encrypted.code);

    await sock.sendMessage(m.chat, {
      document: fs.readFileSync(outPath),
      mimetype: "application/javascript",
      fileName: filename,
      caption: `✅ Berhasil encrypt file ${filename}`
    }, { quoted: m });
    useLimit()

    fs.unlinkSync(outPath);

  } catch (err) {
    console.error(err);
    return Reply("Gagal mengenkripsi file!");
  }
}
break;

case "enc2": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  const jsconfuser = await import("js-confuser");
  let outPath = null;
  if (!m.quoted) return Reply("*ex:* .enc2 dengan reply file .js");
  const obj = m.quoted?.message || m.quoted
  const filename = obj?.documentMessage?.fileName || obj?.fileName || null
  if (!filename || !filename.includes(".js")) return Reply("*ex:* .enc2 dengan reply file .js");
  await Reply(`🌀 Encrypt tingkat tinggi untuk ${filename}...`);
  try {
    const buffer = await m.quoted.download();
    if (!buffer) throw new Error("Gagal download!");
    const inputCode = buffer.toString();
    const encrypted = await jsconfuser.obfuscate(inputCode, {
      target: "node",
      preset: "high",
      stringEncoding: true,
      identifierGenerator: "mangled",
      compact: false,
      renameGlobals: true,
    });

    outPath = `./sampah/${filename}`;
    fs.writeFileSync(outPath, encrypted.code);
    await sock.sendMessage(m.chat, {
      document: fs.readFileSync(outPath),
      mimetype: "application/javascript",
      fileName: filename,
      caption: `✅ Encrypt sukses (enc2)`
    }, { quoted: m });
    useLimit()

    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  } catch (err) {
    console.error("enc2 error:", err);
    if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
    Reply("Gagal encrypt (enc2)!");
  }
}
break;

case "enc3": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
  const jsconfuser = await import("js-confuser");
  let outPath = null;

  if (!m.quoted) return Reply("*ex:* .enc dengan reply file .js");

  const obj = m.quoted?.message || m.quoted
  const filename = obj?.documentMessage?.fileName || obj?.fileName || null
  if (!filename || !filename.includes(".js")) return Reply("*ex:* .enc dengan reply file .js");

  await Reply(`🧬 Melakukan stealth encryption pada ${filename}...`);

  try {
    const buffer = await m.quoted.download();
    if (!buffer) throw new Error("Gagal download!");

    const inputCode = buffer.toString();

    const encrypted = await jsconfuser.obfuscate(inputCode, {
      target: "node",
      preset: "low",
      stringEncoding: false,
      identifierGenerator: "randomized",
      compact: true,
      renameGlobals: false,
    });

    outPath = `./sampah/${filename}`;
    fs.writeFileSync(outPath, encrypted.code);

    await sock.sendMessage(m.chat, {
      document: fs.readFileSync(outPath),
      mimetype: "application/javascript",
      fileName: filename,
      caption: `✅ Encrypt sukses (enc3)`
    }, { quoted: m });

    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    useLimit()

  } catch (err) {
    console.error("enc3 error:", err);
    if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
    Reply("Gagal encrypt (enc3)!");
  }
}
break;

case "minify": {
  if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.quoted) return Reply("*ex:* .enc dengan reply file .js");
  const terser = await import("terser");
  let outPath = null;
  const obj = m.quoted?.message || m.quoted
  const filename = obj?.documentMessage?.fileName || obj?.fileName || null
  if (!filename || !filename.includes(".js")) return Reply("*ex:* .enc dengan reply file .js");
  await Reply(`🔧 Sedang minify ${filename}...`);
  try {
    const buffer = await m.quoted.download();
    if (!buffer) throw new Error("Gagal download file!");

    const inputCode = buffer.toString();

    const terserOptions = {
      compress: {
        passes: 2,
        drop_console: false,
      },
      mangle: true,
      format: { comments: false }
    };

    const result = await terser.minify(inputCode, terserOptions);
    if (!result.code) throw new Error("Terser tidak menghasilkan output.");

    outPath = `./sampah/minified-${filename}`;
    fs.writeFileSync(outPath, result.code);

    await sock.sendMessage(m.chat, {
      document: fs.readFileSync(outPath),
      mimetype: "application/javascript",
      fileName: `${filename}`,
      caption: `✅ Sukses minify: ${filename}`
    }, { quoted: m });
    useLimit()

    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  } catch (e) {
    console.error("Minify error:", e);
    if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
    Reply("Gagal minify file!");
  }
}
break;

//==================================//

case "tourl": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!/image|video|audio|application/.test(mime)) return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    let aa = m.quoted ? await m.quoted.download() : await m.download();
    let dd = await CatBox(aa);
    let msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: `✅ Media berhasil diupload!\n\nURL: ${dd}` },
                    nativeFlowMessage: {
                        buttons: [
                            { 
                                name: "cta_copy", 
                                buttonParamsJson: `{"display_text":"Copy URL","copy_code":"${dd}"}`
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    useLimit()
}
break;

//==================================//

case "tourl2": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!/image/.test(mime)) 
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    try {
        let mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);
        let buffer = fs.readFileSync(mediaPath);
        let directLink = await uploadImageBuffer(buffer);
        await fs.unlinkSync(mediaPath);
        let msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: `✅ Foto berhasil diupload!\n\nURL: ${directLink}` },
                        nativeFlowMessage: {
                            buttons: [
                                { 
                                    name: "cta_copy", 
                                    buttonParamsJson: `{"display_text":"Copy URL","copy_code":"${directLink}"}`
                                }
                            ]
                        }
                    }
                }
            }
        }, { userJid: m.sender, quoted: m });

        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
        useLimit()

    } catch (err) {
        console.error("Tourl Error:", err);
        Reply("Terjadi kesalahan saat mengubah media menjadi URL.");
    }
}
break;

//==================================//

case "toghibli": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!/image/.test(mime)) 
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    try {
        let mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);
        let buffer = fs.readFileSync(mediaPath);
        let directLink = await uploadImageBuffer(buffer);
        await fs.unlinkSync(mediaPath);
        await m.reply(mess.wait)
        const result = `https://api.serverweb.qzz.io/tools/toghibli?apikey=skyy&url=${directLink}`
        await sock.sendMessage(m.chat, { image: { url: result }, caption: "Ghibli Style Image ✅"}, { quoted: m })
        useLimit()

    } catch (err) {
        console.error("Tourl Error:", err);
        Reply("Terjadi kesalahan saat mengubah media menjadi URL.");
    }
}
break;

//==================================//

case "jadianime": {
    if (!cekLimit())
        return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit");

    if (!/image/.test(mime))
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`);

    try {
        const axios = require("axios");
        const FormData = require("form-data");
        const fs = require("fs");

        // download image dari chat
        let mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);

        await Reply("Mengubah style anime, tunggu sebentar...");

        // siapkan form-data
        const formData = new FormData();
        formData.append("apikey", "skyy");
        formData.append("image", fs.createReadStream(mediaPath));

        // kirim ke API
        const res = await axios.post(
            "https://api.serverweb.qzz.io/imagecreator/jadianime",
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );

        // hapus file lokal
        fs.unlinkSync(mediaPath);

        // asumsi API balikin URL hasil
        const resultImage = res.data?.result || res.data?.url;

        if (!resultImage)
            throw new Error("Result image tidak ditemukan");

        await sock.sendMessage(
            m.chat,
            {
                image: { url: resultImage },
                caption: "Anime Style Image ✅",
            },
            { quoted: m }
        );

        useLimit();

    } catch (err) {
        console.error("Jadianime Error:", err.response?.data || err);
        Reply("Terjadi kesalahan saat mengubah gambar ke anime.");
    }
}
break;


case "tohitam": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!/image/.test(mime)) 
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    try {
        let mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);
        let buffer = fs.readFileSync(mediaPath);
        let directLink = await uploadImageBuffer(buffer);
        await fs.unlinkSync(mediaPath);
        await Reply(`Menghitamkan kulit, Tunggu sebentar...`)
        const res = await fetchJson(`https://api.serverweb.qzz.io/tools/tohitam?apikey=skyy&url=${directLink}`)
        await sock.sendMessage(m.chat, { image: { url: res.result }, caption: "Negro Style Image ✅"}, { quoted: m })
        useLimit()

    } catch (err) {
        console.error("Tourl Error:", err);
        Reply("Terjadi kesalahan saat mengubah media menjadi URL.");
    }
}
break;


case "tozombie": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!/image/.test(mime)) 
        return Reply(`*ex:* ${cmd} dengan kirim atau reply image`)
    try {
        let mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);
        let buffer = fs.readFileSync(mediaPath);
        let directLink = await uploadImageBuffer(buffer);
        await fs.unlinkSync(mediaPath);
        await Reply(`Mengubah style zombie, Tunggu sebentar...`)
        const result = `https://api.serverweb.qzz.io/tools/tozombie?apikey=skyy&url=${directLink}`
        await sock.sendMessage(m.chat, { image: { url: result }, caption: "Zombie Style Image ✅"}, { quoted: m })
        useLimit()

    } catch (err) {
        console.error("Tourl Error:", err);
        Reply("Terjadi kesalahan saat mengubah media menjadi URL.");
    }
}
break;

//==================================//

case "buylimit": {
    if (!text) return Reply(`*ex:* ${cmd} 3\nHarga 1 limit = $${global.hargaLimit} Balance`)
    let buy = parseInt(text)
    if (isNaN(buy) || buy < 1) return Reply("Masukan angka yang benar")
    let total = buy * global.hargaLimit
    if (db.users[m.sender].balance < total) 
        return Reply(`Balance kamu kurang.\nMebutuhkan $${toRupiah(total)} Balance untuk membeli ${buy} Limit\nBalance kamu sekarang $${toRupiah(db.users[m.sender].balance)}`)
    db.users[m.sender].balance -= total
    db.users[m.sender].limit += buy
    Reply(`Pembelian Limit Berhasil ✅

+ ${buy} Limit _(- $${toRupiah(total)} Balance)_

📍 Limit: ${toRupiah(db.users[m.sender].limit)}
💰 Balance: $${toRupiah(db.users[m.sender].balance)}`)
}
break

//==================================//

case "topglobal": case "top": {
    let rawUsers = db.users || {}

    let users = Object.fromEntries(
        Object.entries(rawUsers).filter(([jid, data]) => jid.length < 20)
    )

    if (Object.keys(users).length < 1)
        return Reply("Belum ada data user.")

    let dataArray = Object.entries(users).map(([jid, data]) => ({
        jid,
        balance: data.balance || 0,
        limit: data.limit || 0
    }))

    let sortedBalance = [...dataArray].sort((a,b) => b.balance - a.balance)
    let sortedLimit   = [...dataArray].sort((a,b) => b.limit - a.limit)

    let topBalance = sortedBalance.slice(0,20)
    let topLimit   = sortedLimit.slice(0,20)

    let senderJid = m.sender
    let userBalanceRank = sortedBalance.findIndex(u => u.jid === senderJid) + 1
    let userLimitRank   = sortedLimit.findIndex(u => u.jid === senderJid) + 1

    let teks = `
*🏆 LEADERBOARD TOP GLOBAL 🏆*

📌 Kamu berada di ${userBalanceRank} top global balance & ${userLimitRank} top global limit

----------------------------

*💰 Top Global Balance*
${topBalance.map((u,i)=>`${i+1}. @${u.jid.split("@")[0]} — $${u.balance}`).join("\n")}

----------------------------

*📍 Top Global Limit*
${topLimit.map((u,i)=>`${i+1}. @${u.jid.split("@")[0]} — ${u.limit} Limit`).join("\n")}
`.trim()

    let mentions = [
        ...topBalance.map(u => u.jid),
        ...topLimit.map(u => u.jid),
        senderJid
    ]

    sock.sendMessage(m.chat, {
        text: teks,
        mentions
    }, { quoted: m })
}
break

//==================================//

case "cn": {
if (!text) return Reply(`Masukan nama baru!\n*ex:* ${cmd} SilenceVanzxy`)
if (text.length > 20 || text.length < 3) return Reply(`Format nama tidak valid\nTotal huruf wajib diatas 3 huruf!`)
    db.users[m.sender].name = text
    let u = m.sender
    if (!db.users[u]) return Reply(`User tidak terdaftar dalam database`)
    let user = db.users[u]
    let limit = user.limit || 0
    let balance = user.balance || 0
    let nomor = u.split("@")[0]
    let name = user.name || m.pushName
    let premium = user.premium ? "👑 Premium" : "🆓 Free User"

    let teks =
`
 Berhasil mengganti nama ✅
 
  — *User Information*
 ┌ 👤 Name : ${name}
 │ 📍 Limit : ${toRupiah(limit)}
 │ 💰 Balance: $${toRupiah(balance)}
 └ ⭐ Status: ${premium}
`
    m.reply(teks)
}
break

//==================================//

case "getpp": {
  let target
  if (m.quoted) {
    target = m.quoted.sender
  } else if (m.mentionedJid && m.mentionedJid.length > 0) {
    target = m.mentionedJid[0]
  } else if (text) {
    let num = text.replace(/[^0-9]/g, "")
    target = num + "@s.whatsapp.net"
  } else {
    return Reply(`*ex:* ${cmd} @tag/reply`)
  }

  try {
    let ppUrl
    try {
      ppUrl = await sock.profilePictureUrl(target, "image")
    } catch {
      ppUrl = "https://telegra.ph/file/6880771a42bad09dd6087.jpg"
    }

    let bio = "-"
    let setAt = "-"

    try {
      const about = await sock.fetchStatus(target)
      bio = about[0].status?.status || "-"
      if (about[0].status?.setAt) {
        const d = new Date(about[0].status.setAt)
        setAt = d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      }
    } catch {}

    const number = (await sock.toPn(target)).split("@")[0]

    let caption = `
• Number : ${number}
• Bio : ${bio}
• SetAt Bio : ${setAt}
• JID : ${target}
`.trim()

    await sock.sendMessage(m.chat, {
      image: { url: ppUrl },
      caption
    }, { quoted: m })

  } catch (e) {
    reply("❌ Gagal mengambil foto profil atau info user.")
  }
}
break

//==================================//

case "my":
case "ceklimit":
case "limit":
case "balance":
case "cekbalance": {
    let u = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
    u = await sock.toLid(u)
    if (!db.users[u]) return Reply(`User tidak terdaftar dalam database`)
    let user = db.users[u]
    let limit = user.limit || 0
    let balance = user.balance || 0
    let nomor = u.split("@")[0]
    let name = user.name || m.pushName
    let premium = user.premium ? "👑 Premium" : "🆓 Free User"

    let teks =
`
  ⌯ *User Profile Information*
 👤 Name : ${name}
 📍 Limit : ${toRupiah(limit)}
 💰 Balance: $${toRupiah(balance)}
 ⭐ Status: ${premium}
`
    m.reply(teks)
}
break

//==================================//

case "addlimit": {
    if (!isOwner) return Reply(mess.owner)
    let u, l

    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!u || !l) return Reply(`*ex:* ${cmd} 6283XXX|20`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database.`)
    db.users[u].limit += Number(l)
    await m.reply(`✅ Berhasil menambah ${toRupiah(l)} limit ke user @${u.split("@")[0]}`)
}
break

//==================================//

case "dellimit": {
    if (!isOwner) return Reply(mess.owner)
    let u, l

    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!u || !l) return Reply(`*ex:* ${cmd} 6283XXX|20`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database.`)
    if (db.users[u].limit < Number(l)) return Reply(`Limit user tidak cukup`)

    db.users[u].limit -= Number(l)
    await m.reply(`✅ Berhasil mengurangi ${toRupiah(l)} limit dari user @${u.split("@")[0]}`)
}
break

//==================================//

case "addbalance": {
    if (!isOwner) return Reply(mess.owner)
    let u, l

    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!u || !l) return Reply(`*ex:* ${cmd} 6283XXX|20`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database`)

    db.users[u].balance = (db.users[u].balance || 0) + Number(l)
    await m.reply(`💰 Berhasil menambah balance $${toRupiah(l)} ke user @${u.split("@")[0]}`)
}
break

//==================================//

case "delbalance": {
    if (!isOwner) return Reply(mess.owner)
    let u, l

    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!u || !l) return Reply(`*ex:* ${cmd} 6283XXX|20`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database`)

    db.users[u].balance = db.users[u].balance || 0
    if (db.users[u].balance < Number(l)) return Reply(`Balance user tidak cukup`)

    db.users[u].balance -= Number(l)
    await m.reply(`💸 Berhasil mengurangi balance $${toRupiah(l)} dari user @${u.split("@")[0]}`)
}
break

//==================================//

case "tflimit": {
    let u, l
    if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)
    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!db.users[m.sender]) return Reply(`Kamu tidak terdaftar di database`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database`)

    if (db.users[m.sender].limit < Number(l)) return Reply(`Limit kamu tidak cukup`)

    db.users[m.sender].limit -= Number(l)
    db.users[u].limit += Number(l)

    await m.reply(`🔁 *Transfer Limit Berhasil*\n\nDari: @${m.sender.split("@")[0]}\nKe: ${u.split("@")[0]}\nJumlah: ${toRupiah(l)}`)
}
break

//==================================//

case "tfbalance": {
    let u, l
    if (!text) return Reply(`*ex:* ${cmd} 6283XXX|20`)

    if (m.quoted && m.quoted.sender) {
        u = m.quoted.sender
        l = text.trim()
    } else {
        let [target, jumlah] = text.split("|")
        if (!target || !jumlah) return Reply(`*ex:* ${cmd} 6283XXX|20`)
        l = jumlah
        if (target.startsWith("@") && m.mentionedJid[0]) {
            u = m.mentionedJid[0]
        } else {
            u = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
        }
    }
    u = await sock.toLid(u)

    if (!db.users[m.sender]) return Reply(`Kamu tidak terdaftar di database`)
    if (!db.users[u]) return Reply(`User tidak terdaftar didalam database`)

    db.users[m.sender].balance = db.users[m.sender].balance || 0
    db.users[u].balance = db.users[u].balance || 0

    if (db.users[m.sender].balance < Number(l)) return Reply(`Balance kamu tidak cukup`)

    db.users[m.sender].balance -= Number(l)
    db.users[u].balance += Number(l)

    await m.reply(`💸 *Transfer Balance Berhasil*\n\nDari: @${m.sender.split("@")[0]}\nKe: @${u.split("@")[0]}\nJumlah: $${toRupiah(l)}`)
}
break

//==================================//

case "delbl":
case "delbljpm": {
    if (!isOwner) return Reply(mess.owner);

    if (db.settings.bljpm.length < 1) 
        return Reply("Tidak ada data blacklist grup.");

    const groups = await sock.groupFetchAllParticipating();
    const Data = Object.values(groups);

    let rows = [];
    rows.push({
        title: "🗑️ Hapus Semua",
        description: "Hapus semua grup dari blacklist",
        id: `.delbl-response all`
    });

    for (let id of db.settings.bljpm) {
        let name = "Unknown";
        let grup = Data.find(g => g.id === id);
        if (grup) name = grup.subject || "Unknown";
        rows.push({
            title: name,
            description: `ID Grup - ${id}`,
            id: `.delbl-response ${id}|${name}`
        });
    }

    let msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { 
                        text: `Pilih Grup Untuk Dihapus Dari Blacklist\n\nTotal Blacklist: ${db.settings.bljpm.length}` 
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: "Daftar Blacklist Grup",
                                    sections: [
                                        {
                                            title: "Blacklist Terdaftar",
                                            rows: rows
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break;

//==================================//

case "delbl-response": {
    if (!isOwner) return Reply(mess.owner);
    if (!text) return;

    if (text === "all") {
        db.settings.bljpm = [];
        return Reply("✅ Semua data blacklist grup berhasil dihapus.");
    }

    if (text.includes("|")) {
        const [id, grupName] = text.split("|");
        if (!db.settings.bljpm.includes(id)) 
            return Reply(`Grup *${grupName}* tidak ada dalam blacklist.`);

        db.settings.bljpm = db.settings.bljpm.filter(g => g !== id);
        return Reply(`✅ Grup *${grupName}* berhasil dihapus dari blacklist.`);
    }
}
break;

//==================================//

case "statusgc": case "statusgrup": {
if (!isOwner) return Reply(mess.owner)
if (!m.isGroup) return Reply(mess.group)
let status = (yes) => {
return yes ? "*aktif ✅*" : "*tidak aktif ❌*"
}
let gc = db.groups[m.chat]
let teks = `
- Antilink: ${status(gc?.antilink)}
- Welcome: ${status(gc?.welcome)}
`
return Reply(teks)
}
break

//==================================//

case "setwelcome": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} Haii @user Selamat Datang didalam Grup @subject

Keterangan Parameter:
@user = Tag User
@subject = Nama Grup
@desc = Deskripsi Grup
@member = Total Member`);
  
  db.settings.setwelcome = text;
  return Reply("Berhasil mengatur teks Welcome ✅");
}
break;

case "setleave": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} Haii @user Selamat Tinggal

Keterangan Parameter:
@user = Tag User
@subject = Nama Grup
@desc = Deskripsi Grup
@member = Total Member`);
  
  db.settings.setleave = text;
  return Reply("Berhasil mengatur teks Leave ✅");
}
break;

case "welcome": {
  if (!isOwner) return Reply(mess.owner);
  if (!m.isGroup) return Reply(mess.group)

  if (!text)
    return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    db.groups[m.chat].welcome = true;
    return Reply(`Sukses mengaktifkan welcome Grup ${m.metadata.subject}`);
  }

  if (/off/i.test(text)) {
    db.groups[m.chat].welcome = false;
    return Reply(`Sukses mematikan welcome Grup ${m.metadata.subject}`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

//==================================//

case "grouponly": case "gconly": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    db.settings.grouponly = true;
    return Reply(`Mode *Group Only* berhasil diaktifkan ✅`);
  } 
  
  if (/off/i.test(text)) {
    db.settings.grouponly = false;
    return Reply(`Mode *Group Only* berhasil dimatikan ✅`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

//==================================//

case "modesewa": case "sewaonly": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    db.settings.modesewa = true;
    return Reply(`Mode *Sewa Only* berhasil diaktifkan ✅\nBot hanya akan merespon grup yang sedang sewa.`);
  }

  if (/off/i.test(text)) {
    db.settings.modesewa = false;
    return Reply(`Mode *Sewa Only* berhasil dimatikan ❎\nBot akan berfungsi normal di semua grup.`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

case "set":
case "enable": case "on": case "off": 
case "settings": {
  if (!isOwner) return Reply(mess.owner)
  const sendSettingsMenu = async (m) => {
  const isGroup = m.isGroup
  const g = isGroup ? db.groups[m.chat] : {}

  const sections = [
    {
      title: `Group Only • ${db.settings.grouponly ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo grouponly on` },
        { title: "🔴 Matikan", id: `${prefix}setdo grouponly off` }
      ]
    },
    {
      title: `Sewa Only • ${db.settings.modesewa ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo modesewa on` },
        { title: "🔴 Matikan", id: `${prefix}setdo modesewa off` }
      ]
    },
    {
      title: `Auto Read • ${db.settings.autoread ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo autoread on` },
        { title: "🔴 Matikan", id: `${prefix}setdo autoread off` }
      ]
    },
    {
      title: `PC Only • ${db.settings.pconly ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo pconly on` },
        { title: "🔴 Matikan", id: `${prefix}setdo pconly off` }
      ]
    }
  ]

  if (isGroup) {
    sections.push(
      {
        title: `Welcome • ${g.welcome ? "Aktif ✅" : "Nonaktif ❌"}`,
        rows: [
          { title: "🟢 Nyalakan", id: `${prefix}setdo welcome on` },
          { title: "🔴 Matikan", id: `${prefix}setdo welcome off` }
        ]
      },
      {
        title: `Antilink • ${g.antilink ? "Aktif ✅" : "Nonaktif ❌"}`,
        rows: [
          { title: "🟢 Nyalakan", id: `${prefix}setdo antilink on` },
          { title: "🔴 Matikan", id: `${prefix}setdo antilink off` }
        ]
      }
    )
  }

  return sock.sendMessage(m.chat, {
    text: `⚙️ *Settings Manager*\nPilih fitur lain untuk diatur:`,
    buttons: [
      {
        buttonId: "action",
        buttonText: { displayText: "Open Settings" },
        type: 4,
        nativeFlowInfo: {
          name: "single_select",
          paramsJson: JSON.stringify({
            title: "Settings Manager",
            sections
          })
        }
      }
    ],
    headerType: 1
  }, { quoted: m })
}
  await sendSettingsMenu(m)
}
break

case "setdo": {
  if (!isOwner) return Reply(mess.owner)
  if (!text) return Reply("Perintah tidak valid.")
  const sendSettingsMenu = async (m) => {
  const isGroup = m.isGroup
  const g = isGroup ? db.groups[m.chat] : {}

  const sections = [
    {
      title: `Group Only • ${db.settings.grouponly ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo grouponly on` },
        { title: "🔴 Matikan", id: `${prefix}setdo grouponly off` }
      ]
    },
    {
      title: `Sewa Only • ${db.settings.modesewa ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo modesewa on` },
        { title: "🔴 Matikan", id: `${prefix}setdo modesewa off` }
      ]
    },
    {
      title: `Auto Read • ${db.settings.autoread ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo autoread on` },
        { title: "🔴 Matikan", id: `${prefix}setdo autoread off` }
      ]
    },
    {
      title: `PC Only • ${db.settings.pconly ? "Aktif ✅" : "Nonaktif ❌"}`,
      rows: [
        { title: "🟢 Nyalakan", id: `${prefix}setdo pconly on` },
        { title: "🔴 Matikan", id: `${prefix}setdo pconly off` }
      ]
    }
  ]

  if (isGroup) {
    sections.push(
      {
        title: `Welcome • ${g.welcome ? "Aktif ✅" : "Nonaktif ❌"}`,
        rows: [
          { title: "🟢 Nyalakan", id: `${prefix}setdo welcome on` },
          { title: "🔴 Matikan", id: `${prefix}setdo welcome off` }
        ]
      },
      {
        title: `Antilink • ${g.antilink ? "Aktif ✅" : "Nonaktif ❌"}`,
        rows: [
          { title: "🟢 Nyalakan", id: `${prefix}setdo antilink on` },
          { title: "🔴 Matikan", id: `${prefix}setdo antilink off` }
        ]
      }
    )
  }

  return sock.sendMessage(m.chat, {
    text: `⚙️ *Settings Manager*\nPilih fitur lain untuk diatur:`,
    buttons: [
      {
        buttonId: "action",
        buttonText: { displayText: "Open Settings" },
        type: 4,
        nativeFlowInfo: {
          name: "single_select",
          paramsJson: JSON.stringify({
            title: "Settings Manager",
            sections
          })
        }
      }
    ],
    headerType: 1
  }, { quoted: m })
}
  const [feature, action] = text.toLowerCase().split(" ")
  const isGroup = m.isGroup
  const g = isGroup ? db.groups[m.chat] : {}
  const groupName = m.metadata?.subject || "Unknown"

  if (["welcome", "antilink"].includes(feature) && !isGroup) {
    return Reply(mess.group)
  }

  const value = action === "on"

  switch (feature) {
    case "grouponly":
      db.settings.grouponly = value
      break
    case "modesewa":
      db.settings.modesewa = value
      break
    case "autoread":
      db.settings.autoread = value
      break
    case "pconly":
      db.settings.pconly = value
      break
    case "welcome":
      g.welcome = value
      break
    case "antilink":
      g.antilink = value
      break
    default:
      return Reply("Fitur tidak dikenali.")
  }

  // Kirim respon + munculkan menu lagi
  if (["welcome", "antilink"].includes(feature)) {
    await Reply(
      `✅ *${feature}* berhasil ${value ? "diaktifkan" : "dimatikan"} dalam grup *${groupName}*.`
    )
  } else {
    await Reply(
      `✅ *${feature}* berhasil ${value ? "Aktif" : "Nonaktif"}.`
    )
  }
}
break

//==================================//

case "autoread": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    db.settings.autoread = true;
    return Reply(`Mode *Autoread* berhasil diaktifkan ✅`);
  } 
  
  if (/off/i.test(text)) {
    db.settings.autoread = false;
    return Reply(`Mode *Autoread* berhasil dimatikan ✅`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

//==================================//

case "pconly": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    db.settings.pconly = true;
    return Reply(`Mode *Private Chat Only* berhasil diaktifkan ✅`);
  } 
  
  if (/off/i.test(text)) {
    db.settings.pconly = false;
    return Reply(`Mode *Private Chat Only* berhasil dimatikan ✅`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

//==================================//

case "antilink": {
  if (!isOwner) return Reply(mess.owner);
  if (!m.isGroup) return Reply(mess.group)
  if (!text) return Reply(`*ex:* ${cmd} on/off`);

  if (/on/i.test(text)) {
    if (db.groups[m.chat].antilink) return Reply(`Antilink Berhasil di Aktifkan dalam Grup ${m.metadata.subject} ✅`);
    db.groups[m.chat].antilink = true
    return Reply(`Antilink Berhasil di Aktifkan dalam Grup ${m.metadata.subject} ✅`);
  } 
  
  if (/off/i.test(text)) {
    if (!db.groups[m.chat].antilink) return Reply("Antilink Tidak di Aktifkan dalam Grup ini.")
    db.groups[m.chat].antilink = false
    return Reply(`Antilink Berhasil di Aktifkan dalam Grup ${m.metadata.subject} ✅`);
  }

  return Reply(`*ex:* ${cmd} on/off`);
}
break;

//==================================//

case "createch": {
if (!isOwner) return Reply(mess.owner)
if (!text) return Reply(`*ex:* ${cmd} SilenceVanzxy`)
let { id, invite, name } = await sock.newsletterCreate(text)
let result = `
*Channel Berhasil Dibuat ✅*

- ID: ${id}
- Nama: ${name}
- https://whatsapp.com/channel/${invite}
`

let msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: result },
                    nativeFlowMessage: {
                        buttons: [
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Channel ID","copy_code":"${id}"}`
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break

//==================================//

case "listch": case "listchannel": {
if (!isOwner) return Reply(mess.owner)
let teks = ``
let a = await sock.newsletterFetchAllParticipating()
let gc = Object.values(a)
teks += `\n Total Channel: ${gc.length}\n`
for (const u of gc) {
teks += `\n* ID: ${u.id}
* Nama: ${u.name}
* Total Pengikut: ${toRupiah(u.subscribers)}
* https://whatsapp.com/channel/${u.invite}\n`
}
return m.reply(teks)
}
break

//==================================//

case "stalkch":
case "sch": 
case "idch": 
case "cekidch": {
    if (!text) return Reply(`*ex:* ${cmd} https://whatsapp.com/channel/xxx`); 
    if (!text.includes("https://whatsapp.com/channel/") && !text.includes("@newsletter")) {
        return Reply(`*ex:* ${cmd} https://whatsapp.com/channel/xxx`); 
    }
    let result = text.trim()
    let opsi = "jid"
    if (text.includes("https://whatsapp.com/channel/")) {
    result = text.split("https://whatsapp.com/channel/")[1];
    opsi = "invite"
    }
    let res = await sock.newsletterMetadata(opsi, result);
    let teks = `*Channel Information 🌍*\n\n- Nama: ${res.name}\n- Total Pengikut: ${toRupiah(res.subscribers)}\n- ID: ${res.id}\n- Link: https://whatsapp.com/channel/${res.invite}`;

    let msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: teks },
                    nativeFlowMessage: {
                        buttons: [
                            { 
                                name: "cta_copy",
                                buttonParamsJson: `{"display_text":"Copy Channel ID","copy_code":"${res.id}"}`
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break;

//==================================//

case "jpmch": {
    if (!isOwner) return Reply(mess.owner)
    if (!text) return Reply(`*ex:* ${cmd} pesannya & bisa dengan foto juga`)
    let mediaPath
    const mimeType = mime
    if (/image/.test(mimeType)) {
        mediaPath = await sock.downloadAndSaveMediaMessage(qmsg)
    }    
    const Channel = await sock.newsletterFetchAllParticipating()
    let channelList = Object.keys(Channel)
    channelList = channelList.filter(v => Channel[v].viewer_metadata.role !== "SUBSCRIBER")
    if (!channelList || channelList.length < 1) return Reply("Tidak ada channel admin.")
    let successCount = 0
    const messageType = mediaPath ? "teks & foto" : "teks"
    const senderChat = m.chat

    const messageContent = mediaPath
        ? { image: await fs.readFileSync(mediaPath), caption: text }
        : { text }
    global.messageJpm = messageContent
    await Reply(`Memproses JPM ${messageType} ke ${channelList.length} Channel WhatsApp.`)
    for (const chId of channelList) {
        try {
            await sock.sendMessage(chId, global.messageJpm)
            successCount++
        } catch (err) {
            console.error(`Gagal kirim ke channel ${chId}:`, err)
        }
        await sleep(global.JedaJpm)
    }
    if (mediaPath) await fs.unlinkSync(mediaPath)    
    await Reply(`JPM Channel Telah Selsai ✅\nBerhasil dikirim ke ${successCount} Channel WhatsApp.`)
}
break

//==================================//

case "ping": {
const os = require('os');
  const nou = require('node-os-utils');
  const speed = require('performance-now');
  async function getServerInfo(m) {
    const timestamp = speed();
    const tio = await nou.os.oos();
    const tot = await nou.drive.info();
    const memInfo = await nou.mem.info();
    const totalGB = (memInfo.totalMemMb / 1024).toFixed(2);
    const usedGB = (memInfo.usedMemMb / 1024).toFixed(2);
    const freeGB = (memInfo.freeMemMb / 1024).toFixed(2);
    const cpuCores = os.cpus().length;
    const vpsUptime = runtime(os.uptime());
    const botUptime = runtime(process.uptime());
    const latency = (speed() - timestamp).toFixed(4);
    const respon = `
*-- Server Information*
 • OS Platform: ${nou.os.type()}
 • RAM: ${usedGB}/${totalGB} GB used (${freeGB} GB free)
 • Disk Space: ${tot.usedGb}/${tot.totalGb} GB used
 • CPU Cores: ${cpuCores} Core(s)
 • VPS Uptime: ${vpsUptime}

*-- Bot Information*
 • Response Time: ${latency} sec
 • Bot Uptime: ${botUptime}
 • CPU: ${os.cpus()[0].model}
 • Architecture: ${os.arch()}
 • Hostname: ${os.hostname()}
`;
    return Reply(respon);
  }

  return getServerInfo(m);
}
break

//==================================//

case "ht":
case "hidetag": {
    if (!m.isGroup) return Reply(mess.group);
    if (!m.isAdmin && !isOwner) return Reply(mess.admin);
    if (!text) return Reply(`*ex:* ${cmd} haii everyone`);
    try {
        if (!m.metadata || !m.metadata.participants) return Reply("Gagal mendapatkan daftar anggota grup. Coba lagi.");
        const members = m.metadata.participants.map(v => v.id.includes("@s.whatsapp.net") ? v.id : v.jid);
        await sock.sendMessage(m.chat, {
            text: text,
            mentions: members
        }, {
            quoted: null
        });
    } catch (error) {
        console.error("Error sending hidetag message:", error);
        return Reply("Terjadi kesalahan saat mencoba mengirim pesan hidetag.");
    }
}
break;


case "all": case "tagall": {
    if (!m.isGroup) return Reply(mess.group);
    if (!m.isAdmin && !isOwner) return Reply(mess.admin);
    if (!text) return Reply(`*ex:* ${cmd} haii everyone`);
    try {
        await sock.sendMessage(m.chat, {
            text: "@all "+text,
            contextInfo: {
            nonJidMentions: 1
           }
        }, {
            quoted: null
        });
    } catch (error) {
        console.error("Error sending tagall message:", error);
        return Reply("Terjadi kesalahan saat mencoba mengirim pesan tagall.");
    }
}
break;

//==================================//

case "closegc":
case "close":
case "opengc":
case "open": {
    if (!m.isGroup) return Reply(mess.group);
    if (!isOwner && !m.isAdmin) return Reply(mess.admin);
    if (!m.isBotAdmin) return Reply(mess.botadmin);

    try {
        const cmd = command.toLowerCase();

        if (cmd === "open" || cmd === "opengc") {
            await sock.groupSettingUpdate(m.chat, 'not_announcement');
            return Reply("Grup berhasil dibuka! Sekarang semua anggota dapat mengirim pesan.");
        }

        if (cmd === "close" || cmd === "closegc") {
            await sock.groupSettingUpdate(m.chat, 'announcement');
            return Reply("Grup berhasil ditutup! Sekarang hanya admin yang dapat mengirim pesan.");
        }

    } catch (error) {
        console.error("Error updating group settings:", error);
        return Reply("Terjadi kesalahan saat mencoba mengubah pengaturan grup.");
    }
}
break;

//==================================//

case "demote":
case "promote": {
if (!m.isGroup) return Reply(mess.group)
if (!isOwner && !m.isAdmin) return Reply(mess.admin)
if (!m.isBotAdmin) return Reply(mess.botadmin)
if (m.quoted || text) {
var action
let target = m.mentionedJid ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'
if (/demote/.test(command)) action = "Demote"
if (/promote/.test(command)) action = "Promote"
await sock.groupParticipantsUpdate(m.chat, [target], action.toLowerCase()).then(async () => {
await sock.sendMessage(m.chat, {text: `Berhasil ${action.toLowerCase()} @${target.split("@")[0]}`, mentions: [target]}, {quoted: m})
})
} else {
return Reply(`*ex:* ${cmd} @tag/6283XXX`)
}
}
break

//==================================//

case "kick":
case "kik": {
    if (!m.isGroup) return Reply(mess.group);
    if (!isOwner && !m.isAdmin) return Reply(mess.admin);
    if (!m.isBotAdmin) return Reply(mess.botadmin);
    let target;
    if (m.mentionedJid?.[0]) {
        target = m.mentionedJid[0];
    } else if (m.quoted?.sender) {
        target = m.quoted.sender;
    } else if (text) {
        const cleaned = text.replace(/[^0-9]/g, "");
        if (cleaned) target = cleaned + "@s.whatsapp.net";
    }
    if (!target) return Reply(`*ex:* ${cmd} @tag/6283XXX`);
    try {
        await sock.groupParticipantsUpdate(m.chat, [target], "remove");
    } catch (err) {
        console.error("Kick error:", err);
        return Reply("Gagal mengeluarkan anggota. Coba lagi atau cek hak akses bot.");
    }
}
break;

//==================================//

case "pushkontak":
case "puskontak": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} pesannya`)
  global.textpushkontak = text;
  const a = await sock.groupFetchAllParticipating();
  if (!a || !Object.keys(a).length) return Reply("Tidak ada grup chat.");
  global.dataAllGrup = a;
  const rows = Object.values(a).map(u => ({
    title: u.subject || "Unknown",
    description: `Total Member: ${u.participants.length}`,
    id: `.pushkontak-response ${u.id}`
  }));
  await sock.sendMessage(m.chat, {
    buttons: [{
      buttonId: 'action',
      buttonText: { displayText: 'ini pesan interactiveMeta' },
      type: 4,
      nativeFlowInfo: {
        name: 'single_select',
        paramsJson: JSON.stringify({
          title: 'Pilih Target Grup',
          sections: [{ title: 'Pilih Target Grup', rows }]
        })
      }
    }],
    headerType: 1,
    viewOnce: true,
    text: `\nPilih Target Grup Pushkontak\n`
  }, { quoted: m });
}
break;

//==================================//

case "pushkontak-response": {
  if (!isOwner) return Reply(mess.owner)
  if (!global.textpushkontak || !global.dataAllGrup)
    return Reply("Data pushkontak tidak ditemukan!\nSilahkan ketik *.pushkontak* pesannya")

  const gc = global.dataAllGrup
  const teks = global.textpushkontak
  const data = await gc[text]
  const halls = data.participants
    .map(v => v.jid || v.id)
    .filter(id => id !== botNumber)

  await Reply(`🚀 Memulai pushkontak ke grup ${data.subject} (${halls.length} member)`)

  let count = 0
  for (const mem of halls) {
    await sock.sendMessage(mem, { text: teks }, { quoted: fakeQuoted.channel })
    await global.sleep(global.jedaPushkontak)
    count++
  }

  delete global.textpushkontak
  return Reply(`✅ Pushkontak selesai!\nBerhasil dikirim ke *${count}* member.`)
}
break

//==================================//

case "jasher":
case "jpm":
case "jaser": {
  if (!isOwner) return Reply(mess.owner);
  if (!text) return Reply(`*ex:* ${cmd} pesannya & bisa dengan foto juga`);
  let mediaPath;
  if (/image/.test(mime)) {
    mediaPath = await sock.downloadAndSaveMediaMessage(qmsg);
  }
  const allGroups = await sock.groupFetchAllParticipating();
  const que = { quoted: fakeQuoted.channel }
  const groupIds = Object.keys(allGroups);
  let successCount = 0;
  let fail = 0;
  let bl = 0;
  await Reply(`🚀 *Memproses ${mediaPath ? "Jpm Teks & Foto" : "Jpm Teks"}*
- Total Grup: ${groupIds.length}
- Jeda: ${global.jedaJpm}`);
  for (const id of groupIds) {
    if (db.settings.bljpm.includes(id)) {
    bl += 1
    continue
    }
    try {
      if (mediaPath) {
        await sock.sendMessage(id, {
          image: fs.readFileSync(mediaPath),
          caption: text
        }, que);
      } else {
        await sock.sendMessage(id, { text }, que);
      }
      successCount++;
    } catch (e) {
      fail += 1
      console.error(`Gagal kirim ke grup ${id}:`, e);
    }
    await sleep(global.jedaJpm);
  }
  if (mediaPath) fs.unlinkSync(mediaPath);
  await sock.sendMessage(m.chat, {
    text: `*Jpm ${mediaPath ? "Teks & Foto" : "Teks"} berhasil dikirim ✅*
Berhasil: ${successCount}
Gagal: ${fail}
Blacklist: ${bl}`
  }, { quoted: m });
}
break;

case "tebakhero": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)
    if (sock[m.chat] && sock[m.chat].tebakhero)
        return sock.sendMessage(m.chat, {
            text: "Masih ada sesi game *tebak hero* yang belum terselesaikan di grup ini!"
        }, { quoted: sock[m.chat].tebakhero.gameMessage })

    const gameQuestions = await fetchJson('https://api.serverweb.qzz.io/random/heroml?apikey=skyy')
    const { audio, hero } = gameQuestions
    let jawaban = hero

    const hadiah = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let msgg
    try {
    msgg = await sock.sendMessage(
            m.chat,
            {
                audio: { url: audio },
                mimetype: "audio/mpeg", 
                ptt: false, 
                contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 9999, 
                    externalAdReply: {
                    thumbnailUrl: "https://img1.pixhost.to/images/11906/688635364_image.jpg", 
                    title: "🎮 Game Tebak Hero 🎮", 
                    body: `🎁 +$${hadiah} (Waktu 3 menit)`, 
                    previewType: "PHOTO"
                    }
                }
            },
            { quoted: m }
        )
    useLimit()
    } catch (err) {
    console.log(err)
    return Reply("Error terjadi kesalahan saat mengambil gambar soal.")
    }

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].tebakhero = {
        gameAnswer: jawaban,
        hadiah,
        gameRoom: m.chat,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let rm = sock[m.chat]?.tebakhero
            if (rm && rm.idGame === idGame) {
                sock.sendMessage(
                    rm.gameRoom,
                    {
                        text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${rm.gameAnswer}
                        `.trim()
                    },
                    { quoted: rm.gameMessage }
                )
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        {
            text: `*Jawaban Game Tebak Hero*\n* ${sock[m.chat].tebakhero.gameAnswer}`
        },
        { quoted: sock[m.chat].tebakhero.gameMessage }
    )
}
break

case "tebakgambar": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)
    if (sock[m.chat] && sock[m.chat].tebakgambar)
        return sock.sendMessage(m.chat, {
            text: "Masih ada sesi game *tebak gambar* yang belum terselesaikan di grup ini!"
        }, { quoted: sock[m.chat].tebakgambar.gameMessage })

    const gameQuestions = require("./database/game/tebakgambar.js")
    const { img, jawaban, deskripsi } =
        gameQuestions[Math.floor(Math.random() * gameQuestions.length)]

    const hadiah = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Tebak Gambar 🎮*

* *Deskripsi*
${deskripsi}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiah} Balance
`.trim()
    let msgg
    try {
    msgg = await sock.sendMessage(
        m.chat,
        {
            image: { url: img },
            caption: teks,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 9999
            }
        },
        { quoted: m }
    )
    useLimit()
    } catch (err) {
    console.log(err)
    return Reply("Error terjadi kesalahan saat mengambil gambar soal.")
    }

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].tebakgambar = {
        gameQuestion: deskripsi,
        gameAnswer: jawaban,
        hadiah,
        gameRoom: m.chat,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let rm = sock[m.chat]?.tebakgambar
            if (rm && rm.idGame === idGame) {
                sock.sendMessage(
                    rm.gameRoom,
                    {
                        text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${rm.gameAnswer}
                        `.trim()
                    },
                    { quoted: rm.gameMessage }
                )
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        {
            text: `*Jawaban Game Tebak Gambar*\n* ${sock[m.chat].tebakgambar.gameAnswer}`
        },
        { quoted: sock[m.chat].tebakgambar.gameMessage }
    )
}
break

case "siapakahaku": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)

    if (sock[m.chat] && sock[m.chat].siapakahaku)
        return sock.sendMessage(
            m.chat,
            { text: "Masih ada sesi game *siapakahaku* yang belum terselesaikan di grup ini!" },
            { quoted: sock[m.chat].siapakahaku.gameMessage }
        )

    const gameQuestions = require("./database/game/siapakahaku.js")
    const { question, answer } =
        gameQuestions[Math.floor(Math.random() * gameQuestions.length)]

    const hadiah = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Siapakah Aku 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiah} Balance
    `.trim()

    let msgg = await sock.sendMessage(
        m.chat,
        { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } },
        { quoted: m }
    )
    useLimit()

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].siapakahaku = {
        gameQuestion: question,
        gameAnswer: answer,
        gameRoom: m.chat,
        hadiah,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let room = sock[m.chat]?.siapakahaku
            if (room && room.idGame === idGame) {
                sock.sendMessage(
                    room.gameRoom,
                    {
                        text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${room.gameAnswer}
                        `.trim()
                    },
                    { quoted: room.gameMessage }
                )
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        {
            text: `*Jawaban Game Siapakah Aku*\n* ${sock[m.chat].siapakahaku.gameAnswer}`
        },
        { quoted: sock[m.chat].siapakahaku.gameMessage }
    )
}
break

case "kuis": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)
    if (sock[m.chat] && sock[m.chat].kuis) 
        return sock.sendMessage(m.chat, { text: "Masih ada sesi game *kuis* yang belum terselesaikan di grup ini!" }, { quoted: sock[m.chat].kuis.gameMessage })

    const gameQuestions = require("./database/game/kuis.js")
    const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
    const hadiah = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Kuis 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiah} Balance
    `.trim()

    let msgg = await sock.sendMessage(
        m.chat,
        { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } },
        { quoted: m }
    )
    useLimit()

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].kuis = {
        gameQuestion: question,
        gameAnswer: answer,
        gameRoom: m.chat,
        hadiah,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let room = sock[m.chat]?.kuis
            if (room && room.idGame === idGame) {
                sock.sendMessage(room.gameRoom, { 
                    text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${room.gameAnswer}
                    `.trim()
                }, { quoted: room.gameMessage })
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        { text: `*Jawaban Game Kuis*\n* ${sock[m.chat].kuis.gameAnswer}` },
        { quoted: sock[m.chat].kuis.gameMessage }
    )
}
break

case "tebakbendera":
case "tebakflag": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)

    if (sock[m.chat] && sock[m.chat].tebakbendera)
        return sock.sendMessage(m.chat, { text: "Masih ada game *Tebak Bendera* yang belum selesai!" }, { quoted: sock[m.chat].tebakbendera.gameMessage })

    const gameQuestions = require("./database/game/tebakbendera.js")
    const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
    const hadiah = generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Tebak Bendera 🎮*

*- Bendera:* ${question}

*⏰ Waktu:* 3 menit
*🎁 Hadiah:* $${hadiah} Balance
`.trim()

    let msgg = await sock.sendMessage(
        m.chat,
        { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } },
        { quoted: m }
    )

    useLimit()
    const idGame = getRandom("")
    sock[m.chat] = {}

    sock[m.chat].tebakbendera = {
        gameQuestion: question,
        gameAnswer: answer,
        gameRoom: m.chat,
        hadiah,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let room = sock[m.chat]?.tebakbendera
            if (room && room.idGame === idGame) {
                sock.sendMessage(room.gameRoom, {
                    text: `
*Waktu Habis ❌*

*Jawaban:* ${room.gameAnswer}
`.trim()
                }, { quoted: room.gameMessage })
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        { text: `*Jawaban Game Tebak Bendera*\n${sock[m.chat].tebakbendera.gameAnswer}` },
        { quoted: sock[m.chat].tebakbendera.gameMessage }
    )
}
break

case "tebaktebakan": case "tebak": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)
    if (sock[m.chat] && sock[m.chat].tebaktebakan) 
        return sock.sendMessage(m.chat, { text: "Masih ada sesi game *tebak tebakan* yang belum terselesaikan di grup ini!" }, { quoted: sock[m.chat].tebaktebakan.gameMessage })

    const gameQuestions = require("./database/game/tebaktebakan.js")
    const { question, answer } = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
    const hadiah = 
generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Tebak Tebakan 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit
*🎁 Hadiah:* $${hadiah} Balance
    `.trim()

    let msgg = await sock.sendMessage(
        m.chat,
        { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } },
        { quoted: m }
    )
    useLimit()

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].tebaktebakan = {
        gameQuestion: question,
        gameAnswer: answer,
        gameRoom: m.chat,
        hadiah,
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let room = sock[m.chat]?.tebaktebakan
            if (room && room.idGame === idGame) {
                sock.sendMessage(room.gameRoom, { 
                    text: `
*Waktu Game Telah Habis ❌*

*Jawabannya adalah:* 
* ${room.gameAnswer}
                    `.trim()
                }, { quoted: room.gameMessage })
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        { text: `*Jawaban Game Tebak Tebakan*\n* ${sock[m.chat].tebaktebakan.gameAnswer}` },
        { quoted: sock[m.chat].tebaktebakan.gameMessage }
    )
}
break

case "family100": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group)

    if (sock[m.chat] && sock[m.chat].family100)
        return sock.sendMessage(
            m.chat,
            { text: "Masih ada sesi game *family100* yang belum terselesaikan di grup ini!" },
            { quoted: sock[m.chat].family100.gameMessage }
        )

    const gameQuestions = require("./database/game/family100.js")
    const pick = gameQuestions[Math.floor(Math.random() * gameQuestions.length)]
    const { question, answer } = pick

    const hadiah = generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)

    let teks = `
*🎮 Game Family100 🎮*

* *Pertanyaan*
${question}

*⏰ Waktu Game:* 3 menit  
*🎁 Hadiah:* $${hadiah} Balance
    `.trim()

    let msgg = await sock.sendMessage(
        m.chat,
        { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } },
        { quoted: m }
    )
    useLimit()

    const idGame = getRandom("")
    sock[m.chat] = {}
    sock[m.chat].family100 = {
        gameQuestion: question,
        gameAnswer: answer,
        hadiah,
        gameRoom: m.chat,
        users: [],
        idGame,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            let room = sock[m.chat]?.family100
            if (room && room.idGame === idGame) {
                sock.sendMessage(
                    room.gameRoom,
                    {
                        text: `
*⏰ Waktu Game Telah Habis ❌*

*Jawaban yang benar:*
${room.gameAnswer.map(v => `- ${v}`).join("\n")}
                        `.trim()
                    },
                    { quoted: room.gameMessage }
                )
                delete sock[m.chat]
            }
        }, 180000)
    }

    await sock.sendMessage(
        global.owner + "@s.whatsapp.net",
        {
            text: `
*Jawaban Game Family100*
${answer.map(v => `- ${v}`).join("\n")}
            `.trim()
        },
        { quoted: msgg }
    )
}
break

case "boom": case "tebakbom": {
if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
 if (!m.isGroup) return Reply(mess.group); 
 if (sock[m.chat] && sock[m.chat].tebakboom) return sock.sendMessage(m.chat, { text: "Masih ada sesi game tebak boom yang belum terselesaikan di grup ini!" }, { quoted: sock[m.chat].tebakboom.gameMessage });
const hadiah = generateRandomNumber((global.hadiahGame / 2), global.hadiahGame)
const gameQuestions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
let boom = gameQuestions.map((e, i) => (i === 2 || i === 5 ? e + "\n" : e)).join("");

let teks = `
*🎮 Game Tebak Boom 🎮*

${boom}

*⏰ Waktu Game:* 5 Menit
*🎁 Hadiah:* $${hadiah} Balance
 `;

let msgg = await sock.sendMessage(m.chat, { text: teks, contextInfo: { isForwarded: true, forwardingScore: 9999 } }, { quoted: m });

let randomIndex = Math.floor(Math.random() * gameQuestions.length);

const idGame = getRandom("");

sock[m.chat] = sock[m.chat] || {};
sock[m.chat].tebakboom = {
    gameQuestion: [...gameQuestions], // Simpan game board asli tanpa menampilkan bom
    boomIndex: randomIndex, // Simpan indeks bom tanpa menampilkan di game board
    gameRoom: m.chat,
    idGame: idGame,
    hadiah, 
    gameMessage: msgg,
    gameTime: setTimeout(() => {
        if (sock[m.chat] && sock[m.chat].tebakboom && sock[m.chat].tebakboom.idGame === idGame) {
            let bom = sock[m.chat].tebakboom.boomIndex + 1; // Tampilkan posisi bom yang sebenarnya
            sock.sendMessage(m.chat, { text: `
*Waktu Game Telah Habis ❌*

Boom tidak ditemukan 
${bom} = 💣
 `}, { quoted: sock[m.chat].tebakboom.gameMessage });

delete sock[m.chat].tebakboom;
        }
    }, 5 * 60 * 1000) // 5 menit
};

await sock.sendMessage(global.owner + "@s.whatsapp.net", { text: `
Jawaban Game Boom ada di posisi: ${sock[m.chat].tebakboom.boomIndex + 1} `}, { quoted: sock[m.chat].tebakboom.gameMessage }); 
} 
break;

case "tictactoe":
case "ttc": {
    if (!cekLimit()) return Reply("Limit kamu telah habis!\nketik *.buylimit* untuk membeli limit")
    if (!m.isGroup) return Reply(mess.group);
    let lawan = m.mentionedJid[0];
    if (!lawan) return Reply(`Tag lawan dulu!\n\nex:\n${cmd} @user`);

    const TicTacToe = require("./database/game/tictactoe");
    const hadiah = generateRandomNumber((global.hadiahGame / 2), global.hadiahGame);

    if (!sock[m.chat]) sock[m.chat] = {};
    if (sock[m.chat].ttt)
        return m.reply("Masih ada game TicTacToe yang belum selesai di grup ini!");

    // Buat game baru
    let game = new TicTacToe(m.sender, lawan);

    // Map icon papan
    const mapIcon = (board) => board.map((v, i) => {
        if (v === "X") return "❌";
        if (v === "O") return "⭕";
        // Jika masih angka -> jadikan emoji
        return {
            0: "1️⃣",
            1: "2️⃣",
            2: "3️⃣",
            3: "4️⃣",
            4: "5️⃣",
            5: "6️⃣",
            6: "7️⃣",
            7: "8️⃣",
            8: "9️⃣"
        }[i];
    });

    // Render papan awal
    let papan = mapIcon(game.render());

    let teks = `
🎮 *Game TIC TAC TOE*

@${m.sender.split("@")[0]} (❌) vs @${lawan.split("@")[0]} (⭕)

*🎁 Hadiah:* $${hadiah} Balance 💸

Giliran: @${m.sender.split("@")[0]}

${papan.slice(0, 3).join("")}
${papan.slice(3, 6).join("")}
${papan.slice(6, 9).join("")}

Ketik angka *1-9* untuk memilih kotak.
Ketik *surrender* untuk menyerah.
`.trim();

    let msgg = await sock.sendMessage(m.chat, {
        text: teks,
        contextInfo: { mentionedJid: [m.sender, lawan] }
    }, { quoted: m });

    // Simpan game
    sock[m.chat].ttt = {
        idGame: getRandom(""),
        game,
        playerX: m.sender,
        playerO: lawan,
        hadiah,
        gameMessage: msgg,
        gameTime: setTimeout(() => {
            if (!sock[m.chat]?.ttt) return;
            sock.sendMessage(m.chat, { text: "*⏰ Waktu habis! Game dinyatakan INVALID.*" }, { quoted: sock[m.chat].ttt.gameMessage });
            delete sock[m.chat].ttt;
        }, 180000)
    };
}
break;

//==================================//

case "getcase": {
if (!isOwner) return Reply(mess.owner)
if (!text) return Reply(`*ex:* ${cmd} sticker`)
const getcase = (cases) => {
return "case "+`\"${cases}\"`+fs.readFileSync('./message.js').toString().split('case \"'+cases+'\"')[1].split("break")[0]+"break"
}
try {
Reply(`${getcase(q)}`)
} catch (e) {
return Reply(`Case *${text}* tidak ditemukan`)
}
}
break

//==================================//

case "public":
case "self": {
    if (!isOwner) return Reply(mess.owner);
    let path = require.resolve("./config.js");
    let data = fs.readFileSync(path, "utf-8");

    if (command === "public") {
        global.selfmode = false;
        sock.public = global.selfmode
        let newData = data.replace(/global\.selfmode\s*=\s*(true|false)/, "global.selfmode = false");
        fs.writeFileSync(path, newData, "utf-8");
        return Reply("✅ Mode berhasil diubah menjadi *Public*");
    }

    if (command === "self") {
        global.selfmode = true;
        sock.public = global.selfmode
        let newData = data.replace(/global\.selfmode\s*=\s*(true|false)/, "global.selfmode = true");
        fs.writeFileSync(path, newData, "utf-8");
        return Reply("✅ Mode berhasil diubah menjadi *Self*");
    }
}
break;

//==================================//

case "tagsw2": {
  if (!isOwner) return Reply(msg.owner)
  if (!text) return Reply(`Ketik ${cmd} pesannya & bisa dengan foto juga`)
  function getUpswState() {
  if (
    !global.upswState ||
    !Array.isArray(global.upswState.groups)
  ) {
    global.upswState = {
      groups: [],
      lock: false
    }
  }
  return global.upswState
 }

  const state = getUpswState()
  state.groups = []
  state.lock = false

  if (/image/.test(mime)) global.imgsw = qmsg
  global.textupsw = text

  const meta = await sock.groupFetchAllParticipating()

  const list = Object.keys(meta).map(jid => ({
    title: meta[jid].subject,
    id: `.pick-upswa ${jid}|${meta[jid].subject}`,
    description: `${meta[jid].participants.length} Member`
  }))

  return sock.sendMessage(m.chat, {
    buttons: [{
      buttonId: "action",
      buttonText: { displayText: "Pilih Grup (0/5)" },
      type: 4,
      nativeFlowInfo: {
        name: "single_select",
        paramsJson: JSON.stringify({
          title: "Pilih 5 Grup",
          sections: [{
            title: "Daftar Grup",
            rows: list
          }]
        })
      }
    }],
    text: "Silakan pilih 5 grup story tag",
    viewOnce: true
  }, { quoted: m })
}
break

case "pick-upswa": {
  if (!isOwner) return

  const state = global.upswState
  if (state.lock) return
  state.lock = true

  try {
    let [jid, nama] = text.split("|")
    jid = jid?.trim()

    if (!jid || !jid.endsWith("@g.us"))
      return Reply("ID grup tidak valid")

    if (state.groups.length >= 5)
      return Reply("Sudah memilih 5 grup")

    if (state.groups.find(g => g.jid === jid))
      return Reply(`Grup *${nama}* sudah dipilih`)

    state.groups.push({ jid, nama })

    if (state.groups.length < 5) {
      return Reply(
        `✅ ${nama} dipilih\n` +
        `Total: ${state.groups.length}/5`
      )
    }

    return sock.sendMessage(m.chat, {
      buttons: [{
        buttonId: ".create-storywa",
        buttonText: { displayText: "🚀 Buat Status Sekarang" },
        type: 1
      }],
      text:
        `🎯 5 Grup Terpilih\n` +
        state.groups.map((v, i) => `${i + 1}. ${v.nama}`).join("\n")
    }, { quoted: m })

  } finally {
    state.lock = false
  }
}
break

case "create-storywa": {
  if (!isOwner) return Reply(msg.owner)

  const state = global.upswState

  if (!global.textupsw) return Reply("Teks status kosong")
  if (state.groups.length < 5)
    return Reply("Grup belum lengkap")

  const allGroups = await sock.groupFetchAllParticipating()

  async function mentionStatus(jid, content) {
    const group = allGroups[jid]
    if (!group) return

    const users = group.participants.map(v => v.id)
    const colors = ["#7ACAA7","#6E257E","#5796FF","#25C3DC","#FF7B6C"]

    const msg = await sock.sendMessage("status@broadcast", content, {
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      font: 0,
      statusJidList: users
    })

    await sock.relayMessage(jid, {
      groupStatusMentionMessage: {
        message: {
          protocolMessage: {
            key: msg.key,
            type: 25
          }
        }
      }
    }, { userJid: sock.user.jid })
  }

  for (const g of state.groups) {
    if (global.imgsw) {
      const media = await sock.downloadAndSaveMediaMessage(global.imgsw)
      await mentionStatus(g.jid, {
        image: { url: media },
        caption: global.textupsw
      })
      await fs.promises.unlink(media)
    } else {
      await mentionStatus(g.jid, { text: global.textupsw })
    }
  }

  // bersihkan
  state.groups = []
  state.lock = false
  global.textupsw = null
  global.imgsw = null

  return Reply("✅ Status tag grup berhasil dibuat")
}
break

case "tagsw": {
  if (!isOwner) return Reply(msg.owner)
  if (!m.isGroup) return Reply(mess.group)
  if (!text) return Reply(`Ketik ${cmd} pesannya & bisa dengan foto juga`)

  try {
    const meta = await sock.groupFetchAllParticipating()
    const group = meta[m.chat]
    if (!group) return Reply("Gagal mengambil data grup")

    const users = group.participants.map(v => v.id)
    const colors = ["#7ACAA7","#6E257E","#5796FF","#25C3DC","#FF7B6C"]

    let content

    if (/image/.test(mime)) {
      const media = await sock.downloadAndSaveMediaMessage(qmsg)
      content = {
        image: { url: media },
        caption: text
      }
    } else {
      content = { text }
    }

    const msg = await sock.sendMessage("status@broadcast", content, {
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      font: 0,
      statusJidList: users
    })

    await sock.relayMessage(m.chat, {
      groupStatusMentionMessage: {
        message: {
          protocolMessage: {
            key: msg.key,
            type: 25
          }
        }
      }
    }, { userJid: sock.user.jid })

    return Reply("✅ Status berhasil dibuat & grup berhasil di-tag")

  } catch (err) {
    console.error(err)
    return Reply("Terjadi kesalahan saat membuat status")
  }
}
break

case "get": {
if (!isOwner) return Reply(mess.owner);
if (!text) return Reply("*ex:* .get https://img1.pixhost.to/images/xxx");
try {
const res = await axios.get(text,{responseType:"arraybuffer",headers:{"User-Agent":"Mozilla/5.0"}});
const buffer = Buffer.from(res.data);
const type = await FileType.fromBuffer(buffer);
const mime = res.headers["content-type"] || type?.mime || "application/octet-stream";
const ext = type?.ext || mime.split("/")[1] || "bin";
const fileName = `result.${ext}`;
if (mime.startsWith("text/") || /json|xml|html/i.test(mime)) {
const txt = buffer.toString("utf-8");
if (txt.length > 60000) return sock.sendMessage(m.chat,{document:buffer,mimetype:mime,fileName},{quoted:m});
return sock.sendMessage(m.chat,{text:txt},{quoted:m});
}
if (/audio/i.test(mime)) return sock.sendMessage(m.chat,{audio:buffer,mimetype:mime},{quoted:m});
if (/image/i.test(mime)) return sock.sendMessage(m.chat,{image:buffer},{quoted:m});
if (/video/i.test(mime)) return sock.sendMessage(m.chat,{video:buffer},{quoted:m});
return sock.sendMessage(m.chat,{document:buffer,mimetype:mime,fileName},{quoted:m});
} catch (e) { return Reply(`Error: ${e.message}`); }
}
break;

case "backupsc":
case "bck":
case "backup": {
    if (!isOwner) return Reply(mess.owner);
    try {        
        const tmpDir = "./sampah";
        if (fs.existsSync(tmpDir)) {
            const files = fs.readdirSync(tmpDir).filter(f => f !== "SilenceVanzxy");
            for (let file of files) {
                fs.unlinkSync(`${tmpDir}/${file}`);
            }
        }
        await Reply("Backup Script Bot, Tunggu sebentar...");        
        const name = `Script-Selfbot-Multidevice-V4`; 
        const exclude = [
            "node_modules",
            "SilenceVanzxy",
            "session",
            "package-lock.json",
            "yarn.lock",
            ".npm",
            ".cache"
        ];
        const allItems = fs.readdirSync(".", { withFileTypes: true });
        const getFilesRecursive = (dir) => {
            let results = [];
            const list = fs.readdirSync(dir, { withFileTypes: true });
            list.forEach((file) => {
                const fullPath = `${dir}/${file.name}`;
                if (exclude.some(ex => fullPath.startsWith(`./${ex}`) || fullPath.startsWith(`${ex}`))) return; 
                if (file.isDirectory()) {
                    results = results.concat(getFilesRecursive(fullPath));
                } else {
                    results.push(fullPath);
                }
            });
            return results;
        };
        const filesToZip = [];
        allItems.forEach((item) => {
            if (exclude.includes(item.name)) return;
            if (item.isDirectory()) {
                filesToZip.push(item.name);
            } else {
                filesToZip.push(item.name);
            }
        });

        if (!filesToZip.length) return Reply("Tidak ada file yang dapat di-backup.");
        const excludeArgs = exclude.map(e => `-x "${e}/*"`).join(" ");
        execSync(`zip -r ${name}.zip ${filesToZip.join(" ")} ${excludeArgs}`);

        await sock.sendMessage(m.sender, {
            document: fs.readFileSync(`./${name}.zip`),
            fileName: `${name}.zip`,
            mimetype: "application/zip"
        }, { quoted: m });

        fs.unlinkSync(`./${name}.zip`);

        if (m.chat !== m.sender) Reply("Script Bot berhasil dikirim ke Private Chat.");
    } catch (err) {
        console.error("Backup Error:", err);
        Reply("Terjadi kesalahan saat melakukan backup.");
    }
}
break;
    
case "dana":
case "ovo":
case "gopay": {
const walletMap = {
  dana: { name: "DANA", key: global.dana },
  ovo: { name: "OVO", key: global.ovo },
  gopay: { name: "GoPay", key: global.gopay }
};

const wallet = walletMap[command];
if (!wallet || !wallet.key) return Reply("❌ E-wallet belum disetel.");

sock.relayMessage(
  m.chat,
  {
    interactiveMessage: {
      body: { text: `` },
      nativeFlowMessage: {
        buttons: [
          {
            name: "payment_key_info",
            buttonParamsJson: JSON.stringify({
              currency: "IDR",
              total_amount: { value: 0, offset: 100 },
              reference_id: `${wallet.name}-${Date.now()}`,
              type: "digital-goods",
              order: {
                status: "pending",
                subtotal: { value: 0, offset: 100 },
                order_type: "ORDER",
                items: [
                  {
                    name: `Pembayaran ${wallet.name}`,
                    amount: { value: 0, offset: 100 },
                    quantity: 1,
                    sale_amount: { value: 0, offset: 100 }
                  }
                ]
              },
              payment_settings: [
                {
                  type: "payment_key",
                  payment_key: {
                    type: "IDPAYMENTACCOUNT",
                    key: wallet.key,
                    name: wallet.name,
                    institution_name: wallet.name,
                    full_name_on_account: global.ownername,
                    account_type: "ewallet"
                  }
                }
              ],
              share_payment_status: false,
              referral: "chat_attachment"
            })
          }
        ]
      }
    }
  },
  {
    additionalNodes: [
      { tag: "biz", attrs: { native_flow_name: "payment_key_info" } }
    ],
    userJid: m.chat
  }
);
}
break;

//==================================//

default:
if (m.body.toLowerCase().startsWith("xx ")) {
  if (!isOwner) return;
  try {
    const r = await eval(`(async()=>{${text}})()`);
    sock.sendMessage(m.chat, { text: util.format(typeof r === "string" ? r : util.inspect(r)) }, { quoted: m });
  } catch (e) {
    sock.sendMessage(m.chat, { text: util.format(e) }, { quoted: m });
  }
}

if (m.body.toLowerCase().startsWith("x ")) {
  if (!isOwner) return;
  try {
    let r = await eval(text);
    sock.sendMessage(m.chat, { text: util.format(typeof r === "string" ? r : util.inspect(r)) }, { quoted: m });
  } catch (e) {
    sock.sendMessage(m.chat, { text: util.format(e) }, { quoted: m });
  }
}

if (m.body.startsWith('$ ')) {
  if (!isOwner) return;
  exec(m.body.slice(2), (e, out) =>
    sock.sendMessage(m.chat, { text: util.format(e ? e : out) }, { quoted: m })
  );
}}

//==================================//

} catch (err) {
console.log(`Error From Chat: ${m.chat || "Unknown"}\nError: ${util.format(err)}`)
}
}

module.exports = { Skyzopedia }

let file = require.resolve(__filename) 
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(chalk.white("• Update"), chalk.white(`${__filename}\n`))
delete require.cache[file]
require(file)
})