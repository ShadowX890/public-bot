require('dotenv').config();
const fs = require('fs');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// ระบบกันหลับสำหรับ Render
app.get('/', (req, res) => res.send('Public Verify Bot is Online 24/7!'));
app.listen(port, () => console.log(`App listening on port ${port}`));

const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ApplicationCommandOptionType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionFlagsBits,
    ActivityType
} = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ฟังก์ชันโหลด/บันทึก ข้อมูล
function loadDatabase() {
    try {
        const data = fs.readFileSync('database.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function saveDatabase(data) {
    fs.writeFileSync('database.json', JSON.stringify(data, null, 4));
}

// --- 1. ลงทะเบียนคำสั่ง ---
client.once('ready', async () => {
    console.log(`✅ บอท ${client.user.tag} ออนไลน์และพร้อมทำงาน!`);
    
    client.user.setActivity('/info เพื่อดูวิธีใช้', { type: ActivityType.Listening });

    const commands = [
        {
            name: 'info',
            description: '📖 ดูวิธีการใช้งานบอท'
        },
        {
            name: 'verify',
            description: 'สร้างปุ่ม Verify (ตามที่ตั้งค่าไว้)'
        },
        {
            name: 'roleid', 
            description: '⚙️ กำหนด Role ID ที่จะแจกเมื่อ Verify ผ่าน',
            options: [{
                name: 'role',
                description: 'เลือกยศที่ต้องการแจก',
                type: ApplicationCommandOptionType.Role,
                required: true
            }]
        },
        {
            name: 'verifylog', 
            description: '⚙️ กำหนดห้องที่จะส่ง Log',
            options: [{
                name: 'channel',
                description: 'เลือกห้องข้อความ',
                type: ApplicationCommandOptionType.Channel,
                required: true
            }]
        },
        {
            name: 'set-message',
            description: '⚙️ ปรับแต่งข้อความหน้า Verify (เลือกใส่เฉพาะที่ต้องการแก้ได้)',
            options: [
                { name: 'title', description: 'หัวข้อ (Title)', type: ApplicationCommandOptionType.String, required: false },
                { name: 'description', description: 'เนื้อหา (Description)', type: ApplicationCommandOptionType.String, required: false },
                { name: 'footer', description: 'ข้อความเล็กด้านล่าง (Footer)', type: ApplicationCommandOptionType.String, required: false }, // <-- เพิ่มใหม่
                { name: 'button_label', description: 'ชื่อบนปุ่ม (Button Text)', type: ApplicationCommandOptionType.String, required: false } // <-- เพิ่มใหม่
            ]
        }
    ];

    try { await client.application.commands.set(commands); console.log('🎉 ลงทะเบียนคำสั่ง Global เรียบร้อย'); } 
    catch (error) { console.error(error); }
});

// --- 2. Interaction Handler ---
client.on('interactionCreate', async (interaction) => {
    
    // โหลด Database
    let db = loadDatabase();
    if (!db[interaction.guildId]) db[interaction.guildId] = {};

    // ================= Slash Commands =================
    if (interaction.isChatInputCommand()) {
        
        // --- /info ---
        if (interaction.commandName === 'info') {
            const embed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('🤖 คู่มือการใช้งาน Bot')
                .setDescription('บอท Verify ที่ปรับแต่งข้อความได้เอง!')
                .addFields(
                    { name: '🛠️ การตั้งค่า', value: '`/roleid` - เลือกยศที่จะแจก\n`/verifylog` - เลือกห้อง Log\n`/set-message` - แก้ข้อความและปุ่ม' },
                    { name: '🚀 การใช้งาน', value: '`/verify` - เสกปุ่มออกมาใช้งาน' }
                )
                .setFooter({ text: 'Public Verify Bot System' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // --- โซนตั้งค่า (Admin Only) ---
        const configCommands = ['roleid', 'verifylog', 'set-message', 'verify'];
        if (configCommands.includes(interaction.commandName)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '⛔ คำสั่งนี้ใช้ได้เฉพาะ Administrator เท่านั้น', flags: MessageFlags.Ephemeral });
            }
        }

        // --- /roleID ---
        if (interaction.commandName === 'roleid') {
            const role = interaction.options.getRole('role');
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ content: '⚠️ **Error:** ยศบอทอยู่ต่ำกว่ายศที่คุณเลือก! กรุณาเลื่อนยศบอทขึ้นไปบนสุดก่อนครับ', flags: MessageFlags.Ephemeral });
            }
            db[interaction.guildId].roleId = role.id;
            saveDatabase(db);
            await interaction.reply({ content: `✅ บันทึก Role: **${role.name}** เรียบร้อย!`, flags: MessageFlags.Ephemeral });
        }

        // --- /verifylog ---
        if (interaction.commandName === 'verifylog') {
            const channel = interaction.options.getChannel('channel');
            db[interaction.guildId].logChannelId = channel.id;
            saveDatabase(db);
            await interaction.reply({ content: `✅ บันทึกห้อง Log: ${channel} เรียบร้อย!`, flags: MessageFlags.Ephemeral });
        }

        // --- /set-message (อัปเกรดใหม่) ---
        if (interaction.commandName === 'set-message') {
            const title = interaction.options.getString('title');
            const desc = interaction.options.getString('description');
            const footer = interaction.options.getString('footer');
            const btnLabel = interaction.options.getString('button_label');
            
            // อัปเดตเฉพาะค่าที่ User กรอกมา (ถ้าไม่กรอกให้ใช้ค่าเดิม)
            if (title) db[interaction.guildId].customTitle = title;
            if (desc) db[interaction.guildId].customDesc = desc;
            if (footer) db[interaction.guildId].customFooter = footer;
            if (btnLabel) db[interaction.guildId].customBtnLabel = btnLabel;
            
            saveDatabase(db);
            await interaction.reply({ 
                content: `✅ **อัปเดตข้อความเรียบร้อย!**\nTitle: ${title || '(คงเดิม)'}\nDesc: ${desc || '(คงเดิม)'}\nFooter: ${footer || '(คงเดิม)'}\nButton: ${btnLabel || '(คงเดิม)'}`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // --- /verify (เสกปุ่มตามที่ตั้งค่า) ---
        if (interaction.commandName === 'verify') {
            // ดึงค่า Config (ถ้าไม่มีให้ใช้ Default)
            const title = db[interaction.guildId].customTitle || '🔐 Verification Required';
            const desc = db[interaction.guildId].customDesc || 'กรุณากดปุ่มด้านล่าง และกรอกข้อมูลให้ครบถ้วนเพื่อเข้าสู่เซิร์ฟเวอร์';
            const footer = db[interaction.guildId].customFooter || 'กดปุ่มเพื่อเริ่มยืนยันตัวตน';
            const btnLabel = db[interaction.guildId].customBtnLabel || 'Verify Now'; // <-- ชื่อปุ่ม

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(title)
                .setDescription(desc)
                .setFooter({ text: footer }); // <-- ใส่ Footer

            const btn = new ButtonBuilder()
                .setCustomId('btn_verify_public')
                .setLabel(btnLabel) // <-- ใส่ชื่อปุ่ม
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }
    }

    // ================= Button & Modal =================
    if (interaction.isButton() && interaction.customId === 'btn_verify_public') {
        const modal = new ModalBuilder().setCustomId('modal_verify_submit_public').setTitle('📝 แบบฟอร์มยืนยันตัวตน');
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inp_name').setLabel("ชื่อเล่น").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inp_age').setLabel("อายุ (ตัวเลขเท่านั้น)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inp_reason').setLabel("เหตุผลการเข้าเซิร์ฟเวอร์").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_verify_submit_public') {
        const name = interaction.fields.getTextInputValue('inp_name');
        const age = interaction.fields.getTextInputValue('inp_age');
        const reason = interaction.fields.getTextInputValue('inp_reason');

        if (isNaN(age)) return interaction.reply({ content: '❌ กรุณากรอกอายุเป็นตัวเลขเท่านั้นครับ', flags: MessageFlags.Ephemeral });

        const config = db[interaction.guildId];
        
        if (!config || !config.roleId) {
            return interaction.reply({ content: '❌ Admin ยังไม่ได้ตั้งค่า Role (ใช้คำสั่ง `/roleID` ก่อน)', flags: MessageFlags.Ephemeral });
        }

        const role = interaction.guild.roles.cache.get(config.roleId);
        if (!role) return interaction.reply({ content: '❌ ไม่พบยศ (Admin อาจจะลบยศนั้นไปแล้ว)', flags: MessageFlags.Ephemeral });

        try {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับ **${name}**`, flags: MessageFlags.Ephemeral });

            if (config.logChannelId) {
                const logChan = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChan) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('📋 New Member Verified!')
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .addFields(
                            { name: 'User', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
                            { name: 'Name', value: name, inline: true },
                            { name: 'Age', value: age, inline: true },
                            { name: 'Reason', value: reason, inline: false }
                        )
                        .setTimestamp();
                    await logChan.send({ embeds: [logEmbed] });
                }
            }
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ บอทให้ยศไม่ได้ (เช็คยศบอทต้องอยู่สูงกว่ายศที่แจก)', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);