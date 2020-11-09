const Telegraf = require("telegraf")
const Extra = require("telegraf/extra")
const Markup = require("telegraf/markup")
const { Stage, session } = Telegraf
const SceneGen = require("./SceneGen")

const TOKEN = process.env.TOKEN
const bot = new Telegraf(TOKEN)

const KEY = process.env.KEY
const { MongoClient, ObjectId } = require("mongodb")
const uri = `mongodb+srv://Node:${KEY}@cluster0-ttfss.mongodb.net/contesterbot?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })

const admins = [582824629]
const curScenes = new SceneGen()
const stage = new Stage([curScenes.registration()])
bot.use(session())
bot.use(stage.middleware())

bot.command("start", showContest)
async function showContest(ctx) {
  const contest = await contests.findOne({})
  const userId = ctx.from.id

  if (contest.winnerId) {
    sendMsg(ctx, `
Конкурс завершён.
ID победителя: <b>${contest.winnerId}</b>
    `)
  } else {
    if (contest.stop) {
      sendMsg(ctx, `
<b>Конкурс остановлен</b>
Конкурс остановлен и в процессе поиска победителя.
Кол-во участников: ${contest.members.length}
      `)
    } else {
      sendMsg(ctx, `
<b>Добро пожаловать, ${ctx.from.first_name}!</b>
Сейчас проходит конкурс на 1000$!

Условия:
- Придумать стишок о нашем ресторане "Ресторан"
- Нажать на кнопку "Участвовать"
        `, buildInlineMarkup([cbb(`${contest.members.find(u => u == userId)
        ? "✅ " : ""}(${contest.members.length}) Участвовать 🎉`, "participate")]))
    }
  }
}

bot.command("end", async ctx => {
  const userId = ctx.from.id

  if (admins.find(u => u == userId)) {
    const contest = await contests.findOne({})

    await contests.updateOne({ _id: contest._id }, {
      $set: {
        stop: true
      }
    })

    sendMsg(ctx, `Конкурс остановлен.`)

    contest.members.forEach(userId => {
      bot.telegram.sendMessage(userId, "Конкурс остановлен и уже в процессе определения победителя!")
    })
  } else {
    sendMsg(ctx, `Вы не являетесь админом. Чтобы вернуться к конкурсу, введите /start.`)
  }
})

bot.hears(/\/set_winner (.*)/, async ctx => {
  const userId = ctx.from.id

  if (admins.find(u => u == userId)) {
    const winnerId = +ctx.match[1]
    const contest = await contests.findOne({})

    await contests.updateOne({ _id: contest._id }, {
      $set: {
        winnerId
      }
    })

    bot.telegram.sendMessage(winnerId, "Вы победили в конкурсе! Ожидайте связи админа с Вами.")
    bot.telegram.sendMessage(admins[0], `Победитель: <b>${winnerId}</b>
<a href="tg://user?id=${winnerId}">Посмотреть победителя</a>`, { parse_mode: "html" })

    contest.members.filter(u => u != winnerId).forEach(userId => {
      bot.telegram.sendMessage(userId, `Вы проиграли в конкурсе...`)
    })
  } else {
    sendMsg(ctx, `Вы не являетесь админом. Чтобы вернуться к конкурсу, введите /start.`)
  }
})

bot.action("participate", async ctx => {
  const contest = await contests.findOne({})
  const userId = ctx.from.id

  if (contest.stop) {
    ctx.answerCbQuery("Конкурс остановлен, и уже подводятся итоги")
  } else {
    let { members } = contest

    if (members.find(u => u == userId)) {
      members = members.filter(u => u != userId)

      await users.deleteOne({ userId })
      await contests.updateOne({ _id: contest._id }, { $set: { members } })

      ctx.answerCbQuery("Вы перестали участвовать")
      ctx.deleteMessage()
      showContest(ctx)
    } else {
      ctx.scene.enter("reg")
    }
  }
})

function cbb(text, action) {
  return Markup.callbackButton(text, action)
}

function buildInlineMarkup(markup = []) {
  return Extra.markup(Markup.inlineKeyboard(markup))
}

function sendMsg(ctx, msg, markup = []) {
  ctx.replyWithHTML(msg, markup)
}

client.connect(err => {
  if (err) console.log(err)

  global.users = client.db("contesterbot").collection("users")
  global.contests = client.db("contesterbot").collection("contests")

  bot.launch()
})