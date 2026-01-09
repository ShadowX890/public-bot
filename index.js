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
    
    // ตั้งสถานะบอทให้ดูเท่ๆ
    client.user.setActivity('/info เพื่อดูวิธีใช้', { type: ActivityType.Listening });

    const commands = [
        {
            name: 'info',
            description: '📖 ดูวิธีการใช้งานบอท'
        },
        {
            name: 'verify',
            description: 'สร้างปุ่ม Verify (ต้องตั้งค่า roleID และ verifylog ก่อน)'
        },
        {
            name: 'roleid', // Discord บังคับตัวพิมพ์เล็กหมด
            description: '⚙️ กำหนด Role ID ที่จะแจกเมื่อ Verify ผ่าน',
            options: [{
                name: 'role',
                description: 'เลือกยศที่ต้องการแจก',
                type: ApplicationCommandOptionType.Role,
                required: true
            }]
        },
        {
            name: 'verifylog', // Discord บังคับตัวพิมพ์เล็กหมด
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
            description: '⚙️ (เสริม) กำหนดข้อความหน้า Verify เอง',
            options: [
                { name: 'title', description: 'หัวข้อ', type: ApplicationCommandOptionType.String, required: true },
                { name: 'description', description: 'เนื้อหา', type: ApplicationCommandOptionType.String, required: true }
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
                .setDescription('บอท Verify ที่แอดมินตั้งค่าได้เองทุกอย่าง!')
                .addFields(
                    { name: '🛠️ ขั้นตอนการติดตั้ง', value: '1. ใช้ `/roleid` เพื่อเลือกยศที่จะแจก\n2. ใช้ `/verifylog` เพื่อเลือกห้อง Log\n3. ใช้ `/verify` เพื่อเสกปุ่มออกมา' },
                    { name: '⚠️ ข้อควรระวัง', value: 'อย่าลืมลากยศของบอท ให้ **อยู่สูงกว่า** ยศที่จะแจก ไม่งั้นบอทจะแจกยศไม่ได้' }
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
            
            // เช็ค Position ยศ
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

        // --- /set-message ---
        if (interaction.commandName === 'set-message') {
            db[interaction.guildId].customTitle = interaction.options.getString('title');
            db[interaction.guildId].customDesc = interaction.options.getString('description');
            saveDatabase(db);
            await interaction.reply({ content: `✅ บันทึกข้อความ Verify ใหม่เรียบร้อย!`, flags: MessageFlags.Ephemeral });
        }

        // --- /verify (เสกปุ่ม) ---
        if (interaction.commandName === 'verify') {
            // ดึงข้อความ (ถ้าไม่มีให้ใช้ Default)
            const title = db[interaction.guildId].customTitle || '🔐 Verification Required';
            const desc = db[interaction.guildId].customDesc || 'กรุณากดปุ่มด้านล่าง และกรอกข้อมูลให้ครบถ้วนเพื่อเข้าสู่เซิร์ฟเวอร์';

            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle(title).setDescription(desc);
            const btn = new ButtonBuilder().setCustomId('btn_verify_public').setLabel('Verify Now').setStyle(ButtonStyle.Success).setEmoji('✅');

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

        // อ่าน Config ของเซิร์ฟนี้
        const config = db[interaction.guildId];
        
        // เช็คว่า Admin ตั้งค่าหรือยัง?
        if (!config || !config.roleId) {
            return interaction.reply({ content: '❌ Admin ยังไม่ได้ตั้งค่า Role (ใช้คำสั่ง `/roleID` ก่อน)', flags: MessageFlags.Ephemeral });
        }

        const role = interaction.guild.roles.cache.get(config.roleId);
        if (!role) return interaction.reply({ content: '❌ ไม่พบยศ (Admin อาจจะลบยศนั้นไปแล้ว)', flags: MessageFlags.Ephemeral });

        try {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `✅ ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับ **${name}**`, flags: MessageFlags.Ephemeral });

            // ส่ง Log
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