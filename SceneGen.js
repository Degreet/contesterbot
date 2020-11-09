const Scene = require("telegraf/scenes/base")
const Extra = require("telegraf/extra")
const Markup = require("telegraf/markup")

class SceneGen {
  registration() {
    const bot = new Scene("reg")

    bot.enter(async ctx => {
      sendMsg(ctx, `
Придумайте стишок о нашем ресторане "Ресторан",
и отправьте его сюда.
      `, buildInlineMarkup(cbb("❌ Отменить", "cancel")))
    })

    bot.on("message", async ctx => {
      const userId = ctx.from.id
      const poem = ctx.message.text
      const contest = await contests.findOne({})

      contest.members.push(userId)
      ctx.scene.leave()

      await contests.updateOne({ _id: contest._id }, { $set: { members: contest.members } })
      await users.insertOne({ userId, poem })

      sendMsg(ctx, `
Поздравляем! Вы участвуете в конкурсе!
Ожидайте результатов. Чтобы вернуться к конкурсу,
введите /start.
      `)
    })

    bot.action("cancel", async ctx => {
      const userId = ctx.from.id
      await users.deleteOne({ userId })
      sendMsg(ctx, `Вы отменили действие. Чтобы вернуться к конкурсу, введите /start.`)
      ctx.scene.leave()
    })

    return bot
  }
}

function cbb(text, action) {
  return Markup.callbackButton(text, action)
}

function buildInlineMarkup(markup = []) {
  return Extra.markup(Markup.inlineKeyboard(markup))
}

function sendMsg(ctx, msg, markup = []) {
  ctx.replyWithHTML(msg, markup)
}

module.exports = SceneGen