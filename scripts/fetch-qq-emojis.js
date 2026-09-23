const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://koishi.js.org/QFace';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'qq_emoji');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function main() {
  console.log('1. 下载 QQ 表情总索引 _index.json...');
  const indexUrl = `${BASE_URL}/assets/qq_emoji/_index.json`;
  const indexPath = path.join(DATA_DIR, 'qq_emoji_index.json');
  await downloadFile(indexUrl, indexPath);
  console.log('✅ 索引下载完成:', indexPath);

  const emojiList = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  console.log(`总表情数: ${emojiList.length}`);

  // 经典热门精选表情 ID
  const curatedIds = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '10', '11', '12', '13', '14', '21', '49', '96', '104', '110',
    '182', '212', '240', '260', '261', '268', '277', '281',
    '290', '297', '305', '318', '324', '326'
  ];

  console.log(`2. 下载精选核心表情 (共 ${curatedIds.length} 个)...`);

  for (const id of curatedIds) {
    const item = emojiList.find(e => e.emojiId === id);
    if (!item) continue;

    const name = item.describe || id;
    process.stdout.write(`正在下载 [${id}] ${name}... `);

    // 寻找 apng 资源与 png 缩略图
    const apngAsset = item.assets.find(a => a.type === 2);
    const pngAsset = item.assets.find(a => a.type === 0);

    try {
      if (apngAsset) {
        const apngUrl = `${BASE_URL}/${apngAsset.path}`;
        const localApngPath = path.join(ASSETS_DIR, `${id}.png`);
        await downloadFile(apngUrl, localApngPath);
      }
      if (pngAsset) {
        const pngUrl = `${BASE_URL}/${pngAsset.path}`;
        const localPngPath = path.join(ASSETS_DIR, `${id}_thumb.png`);
        await downloadFile(pngUrl, localPngPath);
      }
      console.log('✓ 完成');
    } catch (err) {
      console.log(`⚠️ 失败: ${err.message}`);
    }
  }

  const SUPER_EMOJI_NAMES = {
    '422': '彩虹 (超级表情)',
    '423': '长城 (超级表情)',
    '432': '隐藏款 (超级表情)',
    '450': '撇嘴 (超级表情)',
    '451': '色 (超级表情)',
    '452': '微笑 (超级表情)',
    '453': '发呆 (超级表情)',
    '454': '酷 (超级表情)',
    '455': '害羞 (超级表情)',
    '456': '闭嘴 (超级表情)',
    '457': '睡 (超级表情)',
    '458': '我? (超级表情)',
    '459': '优雅 (超级表情)',
    '460': '等等 (超级表情)',
    '461': '死机 (超级表情)',
    '462': '无语 (超级表情)',
    '463': '新年快乐',
    '464': '飙车 (红马跑车)',
    '465': '抢红包',
    '466': '妖娆 (回眸一笑)',
    '467': '洗剪吹 (托尼老师)',
    '468': '暗中观察 (探头)',
    '469': '男神嘘',
    '470': '企鹅马头套',
    '472': '心碎 (超级表情)',
    '474': '出拳 (超级表情)',
    '475': '干饭 (超级表情)',
    '476': '老哥啥事 (超级表情)',
    '477': '你懂的 (超级表情)',
    '478': '对勾 (超级表情)',
    '479': '叉叉 (超级表情)',
    '480': '退退退 (超级表情)',
    '481': '沉迷学习 (超级表情)',
    '482': '融化 (超级表情)',
    '483': '喵喵 (超级表情)',
    '484': '比心 (超级表情)',
    '485': '摸摸 (超级表情)',
    '488': '老六 (超级表情)',
    '489': '知识学杂了 (超级表情)',
    '490': '能处 (超级表情)',
    '491': '天秀 (超级表情)',
    '492': '打量 (超级表情)',
    '493': '起个大早 (超级表情)'
  };

  // 生成完整纯动态表情清单 (含超级表情，共 290 款)
  const allDynamicList = emojiList
    .filter(e => e.assets && e.assets.some(a => a.type === 2))
    .map(e => {
      const apng = e.assets.find(a => a.type === 2);
      const png = e.assets.find(a => a.type === 0);
      const rawDesc = (e.describe || '').replace(/^\//, '').trim();
      const name = rawDesc || SUPER_EMOJI_NAMES[e.emojiId] || `表情 #${e.emojiId}`;
      return {
        id: e.emojiId,
        name,
        hasApng: true,
        apngPath: apng ? apng.path : null,
        pngPath: png ? png.path : null,
        isCurated: curatedIds.includes(e.emojiId),
        isSuperEmoji: !rawDesc || !!SUPER_EMOJI_NAMES[e.emojiId]
      };
    });

  allDynamicList.sort((a, b) => {
    if (a.isCurated && !b.isCurated) return -1;
    if (!a.isCurated && b.isCurated) return 1;
    return parseInt(a.id, 10) - parseInt(b.id, 10);
  });

  fs.writeFileSync(
    path.join(DATA_DIR, 'emoji_catalog.json'),
    JSON.stringify(allDynamicList, null, 2),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(DATA_DIR, 'emoji_catalog.js'),
    `window.QQ_EMOJI_CATALOG = ${JSON.stringify(allDynamicList, null, 2)};\n`,
    'utf-8'
  );

  console.log(`✅ 纯动态表情目录生成完毕 (共 ${allDynamicList.length} 款)！`);
}

main().catch(console.error);
