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
    '10', '11', '12', '13', '14', '21', '49', '96', '104',
    '182', '212', '240', '260', '261', '268', '277', '281',
    '290', '305', '318', '324', '326'
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

  // 生成简化版精选清单
  const curatedSummary = emojiList.map(e => {
    const apng = e.assets.find(a => a.type === 2);
    const png = e.assets.find(a => a.type === 0);
    return {
      id: e.emojiId,
      name: (e.describe || '').replace(/^\//, ''),
      hasApng: !!apng,
      apngPath: apng ? apng.path : null,
      pngPath: png ? png.path : null,
      isCurated: curatedIds.includes(e.emojiId)
    };
  });

  fs.writeFileSync(
    path.join(DATA_DIR, 'emoji_catalog.json'),
    JSON.stringify(curatedSummary, null, 2),
    'utf-8'
  );
  console.log('✅ 表情目录 emoji_catalog.json 生成完毕！');
}

main().catch(console.error);
