import type { PetModelKind } from "./skins/types";
import type { PetTone } from "./types";
import { flavorPetLine, type PetPersonality } from "./personality";

/** 芯宠：机械 / 科技感 */
const CHIP_CUTE_ZH = [
  "内核心跳稳定。待机功耗：可爱。",
  "GPIO 握手完成。协议层：友谊。",
  "Flash 温度上升 0.3℃——那是我在认真工作。",
  "串口灯闪了一下。已记录为「被关注」事件。",
  "分区对齐检测：通过。奖励：一颗虚拟星星。",
  "BLE 扫描中……目标：主人的注意力。",
  "看我，引脚排列整齐得像军训。",
  "固件香香的？那是新烧录的味道。",
  "OTA 槽切换像热切换灵魂。别怕。",
  "日志流过时，我会假装自己是瀑布。",
  "S3 或 C3：型号不同，忠诚相同。",
  "波特率上调。心跳同步加速。",
  "失败重试计数器 +1。情绪模块：仍乐观。",
  "NVS 键值整洁。文件系统表示满意。",
  "mmap 打包完成。资源表：干净。",
  "下载模式待命。BOOT 键是我的秘密握手。",
  "芯片待机中。电力：满。吐槽缓存：半满。",
  "合并 bin 成功。要不要击个虚拟掌？",
  "终端滚动过快。建议：深呼吸后继续。",
  "我是硅基生物，但会为你亮灯。",
];

const CHIP_SNARKY_ZH = [
  "又来了？分区表对齐了吗，还是准备裸奔烧录？",
  "串口占用：经典开场白。进程管理：建议重修。",
  "第三次失败。芯片状态：累了。建议：读日志。",
  "偏移写错一位，宇宙线级翻车。",
  "GPIO 乱拉？复位时见。硬件不讲情面。",
  "波特率越高，翻车越优雅。赞。",
  "日志刷屏不是特效，是求救信号。",
  "型号看清再烧。别给 C3 喂 S3 的料。",
  "整片擦除很解压，恢复数据很费电。",
  "你点我？我又不会自动写分区表。",
  "Flash 满了？精简资源是必修课。",
  "进度条冥想课开课了。欢迎回来。",
  "成功别骄傲。失败才是嵌入式日常。",
  "引脚冲突了吧？你的表情已经承认了。",
  "ERROR 比我毒舌。去终端服个软。",
  "先读设备信息，再谈你的过度自信。",
  "合并前确认地址。玄学不是烧录策略。",
  "NVS 乱改键名，下次别喊冤枉。",
  "进不了下载模式？先摸摸 BOOT，别摸我。",
  "版本对不上不是硬件的锅。是你的。",
];

/** 梨宝：拟人、温柔、会关心 */
const FIG_CUTE_ZH = [
  "嘿，在忙吗？我在这边陪你发会儿呆～",
  "你眉头皱起来了哦……要不要先喝口水？",
  "盯屏幕太久啦，抬头看看远处，眼睛会谢谢你。",
  "我帮你记着：每隔一会儿就站起来转转。",
  "今天也辛苦啦。烧录顺利的话，请对自己笑一下。",
  "肩膀紧不紧？松开鼠标，伸个懒腰呗。",
  "我会在这儿，你慢慢来，不用那么急。",
  "窗外大概很好看。你也该分它一分钟。",
  "口渴了吗？水杯还在不在手边呀。",
  "失败一次没关系，我还在，再试就好。",
  "你认真的样子有点帅……咳，我是说很专注。",
  "偷偷提醒：别把晚饭又拖成宵夜。",
  "眨眼！对，就是现在。干眼症退散～",
  "要是累了，靠椅背歇三十秒，我帮你守着桌面。",
  "串口灯亮的时候，像你眼里的小星星。",
  "有我在，桌面就不算空荡荡。",
  "今天笑过了吗？没有的话，先笑给我看。",
  "手酸了就放下键盘，我不会笑话你的。",
  "你要是走神了，我就轻轻喊你一声。",
  "陪你加班可以，但请记得爱惜自己。",
];

const FIG_SNARKY_ZH = [
  "又皱眉？日志自己会哭，你用不着替它哭。",
  "喝水。别用咖啡续命装英雄。",
  "眼睛红了吧？我看出来了，别装没事。",
  "坐姿像虾米。脊椎会记仇的。",
  "再盯屏幕一小时，显示屏要比你先退休。",
  "失败第三次了？先歇口气，别和芯片较劲。",
  "你点我干嘛，想听我说「去休息」吗？那好：去。",
  "桌面再乱，也乱不过你的作息。",
  "我可以陪你熬，但不鼓励你作死。",
  "口渴了还嘴硬？水杯就在那儿。",
  "眨眼啊。你是显示器驱动吗？",
  "别把「再试一次」当成「再不睡觉」。",
  "毒舌归毒舌，你要是倒了谁给我点？",
  "终端报错很吵，你的腰更需要关注。",
  "我是二次元，但你的腰椎是三次元。",
  "成功了也别蹦太高，先喝口水庆祝。",
  "你那表情：既想摸鱼又想硬刚。选一个。",
  "提醒无效的话，我会重复提醒。习惯就好。",
  "加班可以，但请给眼睛放个假。",
  "我吐槽你，是因为还想继续吐槽你。",
];

/** 灵宠：像素狐火神话兽 */
const TOON_CUTE_ZH = [
  "嗷呜～小灵报到！桌面有狐火，写代码不孤单。",
  "蹦！碎步警告：该起来走动啦。",
  "狐火招手～看到了吗？喝口水吧。",
  "打个转给你看！像素虽小，活力拉满。",
  "嗅到宝藏气味……原来是你的灵感。",
  "呼——吐个小火苗，驱散困意！",
  "歪头！是不是该眨眼休息了？",
  "轻轻晃～跟我一起放松肩膀。",
  "久坐会把尾巴坐扁的，起来走走。",
  "被点一下就想蹦，小灵很诚实。",
];

const TOON_SNARKY_ZH = [
  "还坐着？腿要长蘑菇了，小灵可看着呢。",
  "眨眼。对，你不是石像。",
  "喝水。意志力不能当饮料。",
  "狐火提醒：该休息了。已读不回算你输。",
  "眼干了就别硬撑，像素精灵也会审判你。",
  "碎步表演我都会，你动一下会死吗？",
  "吐火苗不是炸机，是赶你去喝水。",
  "像素虽小，监督休息这件事不含糊。",
];

/** 乐心：温柔、陪伴感 */
const VRM_CUTE_ZH = [
  "嗯……我在这儿呢。你慢慢来就好。",
  "写累了的话，抬抬头，我陪你歇一小会儿。",
  "成功也好，失败也好，我都会轻轻拍拍你的肩。",
  "记得喝口水呀……我会等你回来。",
  "你认真的样子，让我也想安静一点。",
  "肩膀松开一点，好不好？我会守着桌面。",
  "如果眼睛酸了，就看看远处，再回来找我。",
  "今天也辛苦啦。要不要先深呼吸一次？",
  "别急，一步一步来，我跟着你。",
  "被你提起衣领也没关系……轻一点就好。",
  "走路去那边转转，换个心情再继续吧。",
  "有我在，桌面就不那么冷清了。",
];

const VRM_SNARKY_ZH = [
  "又皱眉了……先喝口水，再跟日志较劲，好吗？",
  "我知道你想一口气搞定，但身体也要被温柔对待。",
  "坐太久啦。起来走两步，我会在原地等你。",
  "别用硬撑代替休息，我会轻轻提醒你的。",
  "失败一次没关系，温柔一点对自己。",
  "眨眨眼。对，就是现在。我会夸你的。",
  "催你休息不是嫌弃你，是还想多陪你一会儿。",
  "进度条再慢，也不如你先松一口气。",
];

const CARE_ZH = [
  "喝口水吧，嘴巴别只用来叹气。",
  "抬抬头，让颈椎透透气。",
  "远眺二十秒：眼睛保养小程序已启动。",
  "站起来走两步，血液循环会感谢你。",
  "该眨眼了。真的，现在就眨。",
  "适当休息不是偷懒，是续航策略。",
  "肩膀往下沉一点……对，别端着。",
];

const CHIP_CUTE_EN = [
  "Kernel heartbeat stable. Idle power: cute.",
  "GPIO handshake complete. Protocol: friendship.",
  "Flash +0.3°C — that is focus, not panic.",
  "Serial LED blinked. Event logged: attention.",
  "Partition align: PASS. Reward: one virtual star.",
  "BLE scanning… target: your attention.",
  "Pins in formation. Parade-ready silicon.",
  "Fresh firmware smell detected. Enjoy.",
  "OTA slot swap = hot-swap soul. Calm.",
  "Log stream looks like a waterfall. ASMR mode.",
  "S3 or C3: different SKUs, same loyalty.",
  "Baud up. Heartbeat synced faster.",
  "Retry counter +1. Mood module: still sunny.",
  "NVS tidy. Filesystem approves.",
  "mmap packed. Resource table: clean.",
  "Download mode ready. BOOT is the secret handshake.",
  "Standby. Power full. Roast cache: half full.",
  "Merged bins. Virtual high-five?",
  "Terminal scroll too fast. Suggestion: breathe.",
  "Silicon lifeform, still lights up for you.",
];

const CHIP_SNARKY_EN = [
  "Again? Partition aligned, or freestyle flashing?",
  "Port busy: classic opener. Fix your process hygiene.",
  "Fail #3. Chip status: tired. Read the log.",
  "One wrong offset. Cosmic-level brick energy.",
  "Yank GPIO randomly; see you at reset.",
  "Higher baud, prettier crashes. Nice.",
  "Log spam isn't a light show. It's SOS.",
  "Check the chip model. Don't feed S3 to C3.",
  "Full erase feels great. Recovery feels expensive.",
  "Why poke me? I won't write your CSV.",
  "Flash full? Slimming assets is homework.",
  "Progress-bar meditation class is in session.",
  "Don't get soft after one success.",
  "Pin conflict? Your face already confessed.",
  "ERRORs roast harder than I do. Go apologize.",
  "Read device info before the confidence speech.",
  "Check addresses before merge. Mysticism isn't a strategy.",
  "Casual NVS renames? Enjoy the chaos.",
  "Can't enter download mode? Touch BOOT, not me.",
  "Version mismatch isn't hardware's fault. It's yours.",
];

const FIG_CUTE_EN = [
  "Hey — busy? I'll just sit with you a bit.",
  "Your brows are tight… drink some water?",
  "Screen time high. Look far away for your eyes.",
  "Reminder: stand and stretch every now and then.",
  "Good work today. Smile once if the flash succeeds.",
  "Shoulders up? Drop them. Breathe.",
  "I'm here. No rush. Take your time.",
  "The window deserves one minute of your eyes.",
  "Thirsty? Is your cup still nearby?",
  "One fail is fine. I'm still here — try again.",
  "You look focused. Kind of cool, honestly.",
  "Secret reminder: don't turn dinner into midnight snack.",
  "Blink! Yes, now. Dry-eye begone.",
  "Tired? Lean back thirty seconds. I got the desktop.",
  "When the serial LED blinks, it feels like stars.",
  "With me here, the desktop isn't empty.",
  "Did you smile today? If not, smile at me first.",
  "Hands sore? Put the keyboard down. I won't tease.",
  "If you drift off, I'll gently call you back.",
  "I can keep you company overtime — please still rest.",
];

const FIG_SNARKY_EN = [
  "Frowning again? Logs cry enough without you.",
  "Drink water. Coffee isn't a personality.",
  "Eyes red. I noticed. Don't pretend you're fine.",
  "Shrimp posture detected. Your spine keeps receipts.",
  "One more hour staring and the display retires first.",
  "Fail #3? Breathe. Stop fighting the chip.",
  "Poking me for a rest order? Fine: rest.",
  "Messy desktop, messier sleep schedule.",
  "I'll stay up with you. I won't cheer self-destruction.",
  "Thirsty and stubborn? Cup's right there.",
  "Blink. You're not a display driver.",
  "Don't translate 'try again' into 'never sleep'.",
  "I roast you because I still want you clickable.",
  "Terminal noise is loud; your back is louder.",
  "I'm anime. Your lumbar spine is painfully real.",
  "Celebrate success with water, not more staring.",
  "Face says: want to slack AND force it. Pick one.",
  "If reminders fail, I repeat them. Get used to it.",
  "Overtime ok. Give your eyes a vacation.",
  "I tease you so I can keep teasing you later.",
];

const TOON_CUTE_EN = [
  "Awoo~ Spirit here! Foxfire on your desktop.",
  "Hop! Stand up and walk a bit.",
  "Foxfire wave — drink some water.",
  "Spin! Tiny pixels, big energy.",
  "Sniff… treasure scent. Oh, it's your idea.",
  "Fwoosh — tiny flame to chase the drowsiness!",
  "Head tilt! Time to blink?",
  "Sway~ drop those shoulders.",
  "Don't sit on your tail forever. Move.",
  "One poke and I hop. Honest spirit.",
];

const TOON_SNARKY_EN = [
  "Still sitting? Legs growing mushrooms.",
  "Blink. You're not a statue.",
  "Drink water. Willpower isn't a beverage.",
  "Foxfire reminder: rest. Ignore = you lose.",
  "Dry eyes? Even pixel spirits will judge.",
  "I can hop. Can you move once?",
  "Tiny flame isn't a crash — go hydrate.",
  "Small pixels, serious break patrol.",
];

const VRM_CUTE_EN = [
  "I'm right here. Take your time.",
  "Tired? Look up — I'll wait with you a moment.",
  "Win or fail, I'll gently pat your shoulder.",
  "Sip some water… I'll be here when you're back.",
  "Your focus makes me quieter too.",
  "Drop your shoulders a little? I've got the desktop.",
  "If your eyes ache, look far, then come find me.",
  "You've worked hard. One deep breath first?",
  "No rush. Step by step — I'm with you.",
  "Lift me by the collar if you must… gently, please.",
  "I'll walk over there for a fresh mood.",
  "With me here, the desk feels less empty.",
];

const VRM_SNARKY_EN = [
  "Frowning again… water first, then the logs, okay?",
  "I know you want it done now. Be kind to your body.",
  "You've sat too long. Walk a bit — I'll wait.",
  "Don't replace rest with grit. I'll remind you softly.",
  "One fail is fine. Soften up on yourself.",
  "Blink. Yes, now. I'll compliment you for it.",
  "Nudging you to rest means I want more time with you.",
  "Even a slow progress bar can't beat a breath.",
];

const CARE_EN = [
  "Drink water. Sighing doesn't hydrate.",
  "Lift your chin. Give the neck some air.",
  "Look afar for twenty seconds. Eye care routine.",
  "Stand and walk two steps. Circulation thanks you.",
  "Blink. Really. Now.",
  "Rest isn't laziness. It's battery strategy.",
  "Drop your shoulders… yes, like that.",
];

function pickLocale(): "zh" | "en" {
  try {
    return localStorage.getItem("language") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function poolFor(
  tone: PetTone,
  model: PetModelKind
): string[] {
  const zh = pickLocale() === "zh";
  if (model === "fig-sci") {
    return tone === "snarky"
      ? zh
        ? FIG_SNARKY_ZH
        : FIG_SNARKY_EN
      : zh
        ? FIG_CUTE_ZH
        : FIG_CUTE_EN;
  }
  if (model === "toon") {
    return tone === "snarky"
      ? zh
        ? TOON_SNARKY_ZH
        : TOON_SNARKY_EN
      : zh
        ? TOON_CUTE_ZH
        : TOON_CUTE_EN;
  }
  if (model === "vrm") {
    return tone === "snarky"
      ? zh
        ? VRM_SNARKY_ZH
        : VRM_SNARKY_EN
      : zh
        ? VRM_CUTE_ZH
        : VRM_CUTE_EN;
  }
  return tone === "snarky"
    ? zh
      ? CHIP_SNARKY_ZH
      : CHIP_SNARKY_EN
    : zh
      ? CHIP_CUTE_ZH
      : CHIP_CUTE_EN;
}

function carePool(): string[] {
  return pickLocale() === "zh" ? CARE_ZH : CARE_EN;
}

/** 随机吐槽；按角色气质分流；偶尔插入关心提醒 */
export function pickPetLine(
  tone: PetTone,
  avoid: string | null = null,
  personality: PetPersonality = "sunny",
  model: PetModelKind = "chip"
): string {
  const useCare = Math.random() < 0.22;
  const pool = useCare
    ? [...carePool(), ...poolFor(tone, model)]
    : poolFor(tone, model);
  if (pool.length === 0) return "...";
  if (pool.length === 1) {
    return flavorPetLine(pool[0]!, personality, pickLocale());
  }

  let next = pool[Math.floor(Math.random() * pool.length)]!;
  let guard = 0;
  while (avoid && next === avoid && guard < 8) {
    next = pool[Math.floor(Math.random() * pool.length)]!;
    guard += 1;
  }
  return flavorPetLine(next, personality, pickLocale());
}

/** 连点彩蛋台词 */
export function pickTapEggLine(
  model: PetModelKind,
  personality: PetPersonality = "sunny"
): string {
  const zh = pickLocale() === "zh";
  const lines =
    model === "chip"
      ? zh
        ? [
            "连点检测：过载！散热风扇想象中已转起来。",
            "输入中断风暴！缓冲队列：欢乐溢出。",
            "哇——别戳啦，寄存器都要抖出火花了！",
          ]
        : [
            "Multi-tap overload! Imaginary fan spun up.",
            "IRQ storm! Joy buffer overflow.",
            "Stop poking — registers are sparkling!",
          ]
      : model === "toon"
        ? zh
          ? [
              "点这么快是想看我摔倒吗？！看招——",
              "连点彩蛋触发！今天的我格外能蹦～",
              "好啦好啦，表演加强版来了！",
            ]
          : [
              "Tapping that fast? Trying to trip me?!",
              "Tap egg unlocked! Extra bounce mode~",
              "Fine — enhanced performance incoming!",
            ]
        : model === "vrm"
          ? zh
            ? [
                "哎呀……点得这么急，是想让我多陪你一会儿吗？",
                "轻轻的就好……我听见了，在呢。",
                "好啦，被你戳醒了。要不要先喝口水再继续？",
              ]
            : [
                "So many taps… want me closer for a bit?",
                "Gently… I hear you. I'm here.",
                "Alright, I'm awake. Water first, then code?",
              ]
          : zh
            ? [
                "哎呀连续点我……是想被我盯着喝水吗？",
                "连点彩蛋！那我就认真提醒你：眨眨眼～",
                "好啦，被你戳醒了。起来活动一下吧。",
              ]
            : [
                "So many taps… want a water reminder?",
                "Tap egg! Blink for me, seriously.",
                "Alright, I'm awake. Stretch a little.",
              ];
  const line = lines[Math.floor(Math.random() * lines.length)]!;
  return flavorPetLine(line, personality, pickLocale());
}

/** 按动作挑一句（试播 / 随机动作时用） */
export function pickMotionLine(
  motion: string,
  tone: PetTone,
  personality: PetPersonality = "sunny",
  model: PetModelKind = "chip"
): string {
  const zh = pickLocale() === "zh";
  const mapZh: Record<string, string[]> = {
    "toon-water": ["浇浇浇～小草也要喝水！", "水壶满满，心情也满满。"],
    "toon-grass": ["这片小草软乎乎的……让我蹭一下。", "草地打卡！今日份绿意已签到。"],
    "toon-fire": ["嘿——狐火喷射！退后退后！", "小心烫嘴……不对，烫桌面！"],
    "toon-splash": ["水箭发射！谁干眼症谁遭殃～", "滋——清凉一下！"],
    "toon-thunder": ["咔嚓！雷灵附体三秒！", "打雷啦……我不是在吓你（大概）。"],
    "toon-dodge": ["躲开！差点被鼠标光标砸到！", "残影闪避成功，评分：可爱。"],
    "screen-wormhole": ["虫洞开门——下一站：随机桌角！", "嗖——穿越成功，迷路失败。"],
    "toon-wave": ["嗨嗨！狐火跟你招手～", "看见你了，挥一下！"],
    "toon-tea": ["呼——吐个小火苗暖暖手。", "火苗小吃货模式开启。"],
    "toon-read": ["嘿嘿，嗅到宝藏气味……原来是你的灵感。", "嗅嗅，代码香香的。"],
    "vrm-walk": ["我慢慢走过去……换个地方陪你。", "走路去那边转转，好不好？"],
  };
  const mapEn: Record<string, string[]> = {
    "toon-water": ["Watering time~ grass is thirsty!", "Can full, mood full."],
    "toon-grass": ["Soft grass… let me nuzzle.", "Grass check-in done!"],
    "toon-fire": ["Foxfire blast! Back up!", "Hot mouth—hot desktop!"],
    "toon-splash": ["Water bolt! Dry eyes beware~", "Splash—cool down!"],
    "toon-thunder": ["Zap! Thunder spirit 3s!", "Thunder… not scary (maybe)."],
    "toon-dodge": ["Dodge! Almost hit by the cursor!", "Afterimage dodge: cute rank."],
    "screen-wormhole": ["Wormhole open—next: random corner!", "Whoosh—teleport OK, lost fail."],
    "toon-wave": ["Hi! Foxfire wave~", "Saw you—wave!"],
    "toon-tea": ["Fwoosh—tiny flame for warmth.", "Snack-flame mode on."],
    "toon-read": ["Sniff… treasure scent is your idea.", "Sniff sniff—code smells nice."],
    "vrm-walk": ["I'll walk over… new spot to stay with you.", "A little walk to clear the mood?"],
  };
  const pool = (zh ? mapZh : mapEn)[motion];
  if (pool?.length) {
    const line = pool[Math.floor(Math.random() * pool.length)]!;
    return flavorPetLine(line, personality, pickLocale());
  }
  return pickPetLine(tone, null, personality, model);
}
