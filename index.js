const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js")
const { token } = require("./config.json")
const fs = require("fs").promises
const path = require("path")

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
})

// Collection to store active tickets, categories, and support role
client.tickets = new Collection()
client.categories = new Collection()
client.supportRoleId = null

// File paths for persistent storage
const DATA_PATH = path.join(__dirname, "data")
const TICKETS_FILE = path.join(DATA_PATH, "tickets.json")
const CATEGORIES_FILE = path.join(DATA_PATH, "categories.json")
const CONFIG_FILE = path.join(DATA_PATH, "config.json")

// Function to ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.access(DATA_PATH)
  } catch {
    await fs.mkdir(DATA_PATH, { recursive: true })
  }
}

// Function to save tickets to file
async function saveTickets() {
  const ticketData = Object.fromEntries(client.tickets)
  await fs.writeFile(TICKETS_FILE, JSON.stringify(ticketData, null, 2))
}

async function saveCategories() {
  const categoryData = {}
  for (const [name, categoryInfo] of client.categories) {
    if (typeof categoryInfo === "object") {
      categoryData[name] = categoryInfo
    } else {
      // Handle old format for backward compatibility
      categoryData[name] = categoryInfo
    }
  }
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categoryData, null, 2))
}

// Function to save config (support role) to file
async function saveConfig() {
  const configData = {
    supportRoleId: client.supportRoleId,
  }
  await fs.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2))
}

// Function to load data from files
async function loadData() {
  try {
    await ensureDataDirectory()

    // Load tickets
    try {
      const ticketData = JSON.parse(await fs.readFile(TICKETS_FILE, "utf-8"))
      for (const [id, ticket] of Object.entries(ticketData)) {
        client.tickets.set(id, ticket)
      }
    } catch (error) {
      console.log("No existing tickets found, starting fresh")
    }

    // Load categories
    try {
      const categoryData = JSON.parse(await fs.readFile(CATEGORIES_FILE, "utf-8"))
      for (const [name, categoryInfo] of Object.entries(categoryData)) {
        if (typeof categoryInfo === "object" && categoryInfo.id) {
          // New format with full category info
          client.categories.set(name, categoryInfo)
        } else {
          // Old format - just the ID, create default structure
          client.categories.set(name, {
            id: categoryInfo,
            label: name.charAt(0).toUpperCase() + name.slice(1),
            description: `تیکت‌های ${name}`,
            emoji: "📝",
          })
        }
      }
    } catch (error) {
      console.log("No existing categories found, starting fresh")
    }

    // Load config
    try {
      const configData = JSON.parse(await fs.readFile(CONFIG_FILE, "utf-8"))
      client.supportRoleId = configData.supportRoleId
    } catch (error) {
      console.log("No existing config found, starting fresh")
    }
  } catch (error) {
    console.error("Error loading data:", error)
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`)

  // Load saved data
  await loadData()

  const commands = [
    {
      name: "ticket",
      description: "ایجاد پیام تیکت در کانال",
      options: [
        {
          name: "channel",
          description: "کانالی که پیام تیکت در آن ارسال می‌شود",
          type: 7,
          required: true,
        },
      ],
    },
    {
      name: "setup",
      description: "تنظیم دسته‌بندی‌های سیستم تیکت (فقط ادمین)",
      options: [
        {
          name: "exchange",
          description: "دسته‌بندی برای تیکت‌های Exchange",
          type: 7,
          required: true,
        },
        {
          name: "staff",
          description: "دسته‌بندی برای تیکت‌های Staff Apply",
          type: 7,
          required: true,
        },
        {
          name: "winners",
          description: "دسته‌بندی برای تیکت‌های Winners",
          type: 7,
          required: true,
        },
        {
          name: "other",
          description: "دسته‌بندی برای تیکت‌های Other",
          type: 7,
          required: true,
        },
        {
          name: "support_role",
          description: "رول پشتیبانی که به تمام تیکت‌ها دسترسی خواهد داشت",
          type: 8, // ROLE type
          required: true,
        },
      ],
    },
    {
      name: "addcategory",
      description: "اضافه کردن دسته‌بندی جدید به سیستم تیکت (فقط ادمین)",
      options: [
        {
          name: "name",
          description: "نام دسته‌بندی (انگلیسی، بدون فاصله)",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "label",
          description: "برچسب نمایشی دسته‌بندی",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "description",
          description: "توضیحات دسته‌بندی",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "emoji",
          description: "ایموجی دسته‌بندی",
          type: 3, // STRING type
          required: true,
        },
        {
          name: "category_channel",
          description: "کانال دسته‌بندی که تیکت‌ها در آن ایجاد می‌شوند",
          type: 7, // CHANNEL type
          required: true,
        },
      ],
    },
    {
      name: "deletecategory",
      description: "حذف دسته‌بندی از سیستم تیکت (فقط ادمین)",
      options: [
        {
          name: "name",
          description: "نام دسته‌بندی برای حذف",
          type: 3, // STRING type
          required: true,
        },
      ],
    },
  ]

  client.application.commands.set(commands)
})

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === "ticket") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: "شما به دسترسی ادمین نیاز دارید تا بتوانید پیام تیکت را تنظیم کنید!",
            ephemeral: true,
          })
        }

        const channel = interaction.options.getChannel("channel")
        if (channel.type !== ChannelType.GuildText) {
          return interaction.reply({
            content: "لطفاً یک کانال متنی انتخاب کنید!",
            ephemeral: true,
          })
        }

        await handleTicketCommand(channel)
        await interaction.reply({
          content: `پیام تیکت با موفقیت در کانال ${channel} تنظیم شد!`,
          ephemeral: true,
        })
      } else if (interaction.commandName === "setup") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: "شما به دسترسی ادمین نیاز دارید تا بتوانید سیستم تیکت را تنظیم کنید!",
            ephemeral: true,
          })
        }

        const categories = {
          exchange: interaction.options.getChannel("exchange"),
          staff: interaction.options.getChannel("staff"),
          winners: interaction.options.getChannel("winners"),
          other: interaction.options.getChannel("other"),
        }

        for (const [name, category] of Object.entries(categories)) {
          if (category.type !== ChannelType.GuildCategory) {
            return interaction.reply({
              content: `لطفاً یک دسته‌بندی برای ${name} انتخاب کنید!`,
              ephemeral: true,
            })
          }
          client.categories.set(name, category.id)
        }

        // Get and save support role
        const supportRole = interaction.options.getRole("support_role")
        client.supportRoleId = supportRole.id

        // Save categories and config
        await saveCategories()
        await saveConfig()

        await interaction.reply({
          content: `دسته‌بندی‌های سیستم تیکت با موفقیت تنظیم شدند! رول پشتیبانی: ${supportRole.name}`,
          ephemeral: true,
        })
      } else if (interaction.commandName === "addcategory") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: "شما به دسترسی ادمین نیاز دارید تا بتوانید دسته‌بندی اضافه کنید!",
            ephemeral: true,
          })
        }

        const name = interaction.options.getString("name").toLowerCase()
        const label = interaction.options.getString("label")
        const description = interaction.options.getString("description")
        const emoji = interaction.options.getString("emoji")
        const categoryChannel = interaction.options.getChannel("category_channel")

        // Validate category name (only letters, numbers, underscore)
        if (!/^[a-z0-9_]+$/.test(name)) {
          return interaction.reply({
            content: "نام دسته‌بندی باید فقط شامل حروف انگلیسی، اعداد و خط زیر باشد!",
            ephemeral: true,
          })
        }

        if (categoryChannel.type !== ChannelType.GuildCategory) {
          return interaction.reply({
            content: "لطفاً یک دسته‌بندی انتخاب کنید!",
            ephemeral: true,
          })
        }

        // Check if category already exists
        if (client.categories.has(name)) {
          return interaction.reply({
            content: "این دسته‌بندی قبلاً وجود دارد!",
            ephemeral: true,
          })
        }

        // Add the new category
        client.categories.set(name, {
          id: categoryChannel.id,
          label: label,
          description: description,
          emoji: emoji,
        })

        // Save categories
        await saveCategories()

        await interaction.reply({
          content: `دسته‌بندی "${label}" با موفقیت اضافه شد!`,
          ephemeral: true,
        })
      } else if (interaction.commandName === "deletecategory") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: "شما به دسترسی ادمین نیاز دارید تا بتوانید دسته‌بندی حذف کنید!",
            ephemeral: true,
          })
        }

        const name = interaction.options.getString("name").toLowerCase()

        // Check if category exists
        if (!client.categories.has(name)) {
          return interaction.reply({
            content: "این دسته‌بندی وجود ندارد!",
            ephemeral: true,
          })
        }

        // Get category info before deletion
        const categoryInfo = client.categories.get(name)
        const categoryLabel = typeof categoryInfo === "object" ? categoryInfo.label : name

        // Remove the category
        client.categories.delete(name)

        // Save categories
        await saveCategories()

        await interaction.reply({
          content: `دسته‌بندی "${categoryLabel}" با موفقیت حذف شد!`,
          ephemeral: true,
        })
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "ticket_topic") {
        const topic = interaction.values[0]
        await createTopicTicket(interaction, topic)
      }
    }

    if (interaction.isButton()) {
      const [action, userId, ticketId] = interaction.customId.split(":")

      if (action === "close_ticket") {
        await closeTicket(interaction, ticketId)
      } else if (action === "delete_ticket") {
        await deleteTicket(interaction, ticketId)
      } else if (action === "confirm_delete") {
        await confirmDeleteTicket(interaction, ticketId)
      } else if (action === "cancel_delete") {
        await cancelDeleteTicket(interaction, ticketId)
      }
    }
  } catch (error) {
    console.error("Error handling interaction:", error)
    try {
      const errorMessage = "خطایی در پردازش درخواست شما رخ داد."
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true })
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true })
      }
    } catch (e) {
      console.error("Error sending error message:", e)
    }
  }
})

async function handleTicketCommand(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("🎫 سیستم تیکت")
    .setDescription("برای ارسال تیکت، یکی از گزینه‌های زیر را انتخاب کنید.")

  // Generate options dynamically from available categories
  const options = []
  for (const [name, categoryInfo] of client.categories) {
    const info =
      typeof categoryInfo === "object"
        ? categoryInfo
        : {
            label: name.charAt(0).toUpperCase() + name.slice(1),
            description: `تیکت‌های ${name}`,
            emoji: "📝",
          }

    options.push({
      label: info.label,
      description: info.description,
      value: name,
      emoji: info.emoji,
    })
  }

  if (options.length === 0) {
    return channel.send({
      content:
        "هیچ دسته‌بندی‌ای برای تیکت تنظیم نشده است. لطفاً ابتدا دسته‌بندی‌ها را با دستور `/setup` یا `/addcategory` تنظیم کنید.",
    })
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId("ticket_topic").setPlaceholder("انتخاب موضوع تیکت").addOptions(options),
  )

  await channel.send({
    embeds: [embed],
    components: [row],
  })
}

async function createTopicTicket(interaction, topic) {
  await interaction.deferUpdate()

  const user = interaction.user
  const guild = interaction.guild

  const existingTicket = client.tickets.find((ticket) => ticket.userId === user.id && ticket.closed === false)
  if (existingTicket) {
    return interaction.followUp({
      content: `شما در حال حاضر یک تیکت باز دارید: <#${existingTicket.channelId}>`,
      ephemeral: true,
    })
  }

  const categoryInfo = client.categories.get(topic)
  if (!categoryInfo) {
    return interaction.followUp({
      content: "سیستم تیکت به درستی تنظیم نشده است. لطفاً با ادمین تماس بگیرید.",
      ephemeral: true,
    })
  }

  const categoryId = typeof categoryInfo === "object" ? categoryInfo.id : categoryInfo
  const topicLabel =
    typeof categoryInfo === "object" ? categoryInfo.label : topic.charAt(0).toUpperCase() + topic.slice(1)

  // Create permission overwrites array
  const permissionOverwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ]

  // Add support role permissions if it exists
  if (client.supportRoleId) {
    permissionOverwrites.push({
      id: client.supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    })
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${topic}-${user.username}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: permissionOverwrites,
  })

  const ticketId = Date.now().toString(36) + Math.random().toString(36).substr(2)

  const ticketData = {
    id: ticketId,
    userId: user.id,
    channelId: ticketChannel.id,
    topic: topicLabel,
    createdAt: new Date(),
    closed: false,
    messageId: null,
  }

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_ticket:${user.id}:${ticketId}`)
      .setLabel("بستن تیکت")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  )

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`تیکت ${topicLabel}`)
    .setDescription(
      `${user} به تیکت خود خوش آمدید. تیم پشتیبانی به زودی به شما کمک خواهد کرد.\n\nلطفاً مشکل خود را به طور کامل شرح دهید.`,
    )
    .addFields(
      { name: "موضوع", value: topicLabel, inline: true },
      { name: "ایجاد شده توسط", value: user.tag, inline: true },
      { name: "شناسه تیکت", value: ticketId, inline: true },
    )
    .setTimestamp()

  const welcomeMessage = await ticketChannel.send({
    content: `${user} به تیکت خود خوش آمدید!`,
    embeds: [ticketEmbed],
    components: [closeButton],
  })

  // Ping support role if it exists
  if (client.supportRoleId) {
    await ticketChannel.send({
      content: `<@&${client.supportRoleId}> یک تیکت جدید ایجاد شده است.`,
      allowedMentions: { roles: [client.supportRoleId] },
    })
  }

  // Store the welcome message ID for later updates
  ticketData.messageId = welcomeMessage.id
  client.tickets.set(ticketId, ticketData)

  // Save tickets after creation
  await saveTickets()

  await interaction.followUp({
    content: `تیکت شما ایجاد شد: ${ticketChannel}`,
    ephemeral: true,
  })
}

async function closeTicket(interaction, ticketId) {
  const ticket = client.tickets.get(ticketId)

  if (!ticket) {
    return interaction.reply({ content: "این تیکت دیگر وجود ندارد.", ephemeral: true })
  }

  // Check if ticket is already closed
  if (ticket.closed) {
    return interaction.reply({
      content: "این تیکت قبلاً بسته شده است.",
      ephemeral: true,
    })
  }

  // Check if user has permission to close the ticket
  const isTicketCreator = interaction.user.id === ticket.userId
  const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
  const isSupportRole = client.supportRoleId && interaction.member.roles.cache.has(client.supportRoleId)

  if (!isTicketCreator && !hasManageChannels && !isSupportRole) {
    return interaction.reply({
      content: "شما دسترسی لازم برای بستن این تیکت را ندارید.",
      ephemeral: true,
    })
  }

  // Mark ticket as closed
  ticket.closed = true
  client.tickets.set(ticketId, ticket)

  // Save tickets after closing
  await saveTickets()

  await interaction.reply({ content: "در حال بستن تیکت..." })

  try {
    const channel = await interaction.guild.channels.fetch(ticket.channelId)
    if (channel) {
      // Rename the channel to include 'closed'
      await channel.setName(`closed-${channel.name}`)

      // Remove access for the ticket creator
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
      })

      // Update permissions for everyone
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        ViewChannel: false,
        SendMessages: false,
      })

      // Keep access for support role
      if (client.supportRoleId) {
        await channel.permissionOverwrites.edit(client.supportRoleId, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
        })
      }

      // Disable the close button in the original message and add delete button
      if (ticket.messageId) {
        try {
          const originalMessage = await channel.messages.fetch(ticket.messageId)
          if (originalMessage) {
            const updatedButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`closed:${ticket.userId}:${ticketId}`)
                .setLabel("تیکت بسته شده")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("🔒")
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(`delete_ticket:${ticket.userId}:${ticketId}`)
                .setLabel("حذف تیکت")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🗑️"),
            )

            await originalMessage.edit({ components: [updatedButtons] })
          }
        } catch (error) {
          console.error("Could not update original message:", error)
        }
      }

      // Send closure notification
      const closedEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("تیکت بسته شد")
        .setDescription("این تیکت بسته شده و بایگانی شده است.")
        .addFields(
          { name: "بسته شده توسط", value: interaction.user.tag, inline: true },
          { name: "ایجاد کننده اصلی", value: `<@${ticket.userId}>`, inline: true },
        )
        .setTimestamp()

      const deleteButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`delete_ticket:${ticket.userId}:${ticketId}`)
          .setLabel("حذف تیکت")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
      )

      await channel.send({
        embeds: [closedEmbed],
        components: [deleteButton],
      })

      // Notify the user that their ticket was closed
      try {
        const ticketCreator = await interaction.guild.members.fetch(ticket.userId)
        await ticketCreator.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("تیکت شما بسته شد")
              .setDescription(`تیکت شما توسط ${interaction.user.tag} بسته شد`)
              .setTimestamp(),
          ],
        })
      } catch (error) {
        console.log("Could not DM ticket creator")
      }
    }
  } catch (error) {
    console.error("Error closing ticket:", error)
    await interaction.followUp({
      content: "خطایی هنگام بستن تیکت رخ داد.",
      ephemeral: true,
    })
  }
}

async function deleteTicket(interaction, ticketId) {
  const ticket = client.tickets.get(ticketId)

  if (!ticket) {
    return interaction.reply({ content: "این تیکت دیگر وجود ندارد.", ephemeral: true })
  }

  // Check if ticket is closed before allowing deletion
  if (!ticket.closed) {
    return interaction.reply({
      content: "شما باید ابتدا تیکت را ببندید و سپس آن را حذف کنید.",
      ephemeral: true,
    })
  }

  // Check if user has permission to delete tickets
  const hasManageChannels = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
  const isSupportRole = client.supportRoleId && interaction.member.roles.cache.has(client.supportRoleId)

  if (!hasManageChannels && !isSupportRole) {
    return interaction.reply({
      content: "شما دسترسی لازم برای حذف تیکت‌ها را ندارید.",
      ephemeral: true,
    })
  }

  // Ask for confirmation before deleting
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("تأیید حذف تیکت")
    .setDescription("آیا مطمئن هستید که می‌خواهید این تیکت را حذف کنید؟ این عمل قابل بازگشت نیست.")
    .setTimestamp()

  const confirmButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_delete:${ticket.userId}:${ticketId}`)
      .setLabel("بله، حذف شود")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(`cancel_delete:${ticket.userId}:${ticketId}`)
      .setLabel("انصراف")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("❌"),
  )

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmButtons],
    ephemeral: true,
  })
}

async function confirmDeleteTicket(interaction, ticketId) {
  const ticket = client.tickets.get(ticketId)

  if (!ticket) {
    return interaction.update({
      content: "این تیکت دیگر وجود ندارد.",
      embeds: [],
      components: [],
      ephemeral: true,
    })
  }

  await interaction.update({
    content: "در حال حذف تیکت...",
    embeds: [],
    components: [],
    ephemeral: true,
  })

  try {
    // Delete the channel
    const channel = await interaction.guild.channels.fetch(ticket.channelId)
    if (channel) {
      await channel.delete()
    }

    // Remove the ticket from the collection
    client.tickets.delete(ticketId)

    // Save tickets after deletion
    await saveTickets()

    await interaction.followUp({
      content: "تیکت با موفقیت حذف شد.",
      ephemeral: true,
    })
  } catch (error) {
    console.error("Error deleting ticket:", error)
    await interaction.followUp({
      content: "خطایی هنگام حذف تیکت رخ داد.",
      ephemeral: true,
    })
  }
}

async function cancelDeleteTicket(interaction, ticketId) {
  await interaction.update({
    content: "حذف تیکت لغو شد.",
    embeds: [],
    components: [],
    ephemeral: true,
  })
}

client.login(token)
