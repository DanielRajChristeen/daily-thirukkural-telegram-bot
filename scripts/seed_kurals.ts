import * as fs from 'fs';
import * as path from 'path';
import { kurals as curatedKurals } from '../src/kurals.js';
import { chapters } from '../src/chapters.js';

interface RawKural {
  Number: number;
  Line1: string;
  Line2: string;
  Translation: string;
  mv: string;
  sp: string;
  mk: string;
  explanation: string;
  couplet: string;
  transliteration1: string;
  transliteration2: string;
}

interface Kural {
  id: number;
  paaal: string;
  adhigaram_id: number;
  adhigaram: string;
  kural: string;
  vilakam: string;
  transliteration: string;
  english: string;
}

async function run() {
  console.log('🚀 Seeding all 1330 Kurals offline...');
  const DATA_DIR = path.join(process.cwd(), 'data');
  const OUTPUT_FILE = path.join(DATA_DIR, 'kurals_all.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    const response = await fetch('https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json');
    if (!response.ok) {
      throw new Error(`Failed to download database. HTTP ${response.status}`);
    }

    const rawData = await response.json();
    const rawList = rawData.kural as RawKural[];
    console.log(`📥 Downloaded ${rawList.length} raw Kurals from GitHub.`);

    // Index curated kurals for quick lookup
    const curatedMap = new Map<number, typeof curatedKurals[0]>();
    for (const k of curatedKurals) {
      curatedMap.set(k.id, k);
    }

    const finalKurals: Kural[] = [];

    for (let id = 1; id <= 1330; id++) {
      // 1. If we have a hand-curated Kural, preserve it!
      if (curatedMap.has(id)) {
        finalKurals.push(curatedMap.get(id) as Kural);
        continue;
      }

      // 2. Otherwise, find the raw data from GitHub
      const raw = rawList.find(r => r.Number === id);
      if (!raw) {
        console.warn(`⚠️ Kural ${id} not found in raw list!`);
        continue;
      }

      // Compute adhigaram and section
      const adhigaram_id = Math.ceil(id / 10);
      const chapter = chapters.find(c => c.id === adhigaram_id);
      const adhigaram = chapter ? chapter.name : '';
      const paaal = chapter ? chapter.section : '';

      // Format clean local Kural
      const kural: Kural = {
        id,
        paaal,
        adhigaram_id,
        adhigaram,
        kural: `${raw.Line1}<br />${raw.Line2}`,
        vilakam: raw.mv || raw.sp || raw.mk || '',
        transliteration: `${raw.transliteration1}  ${raw.transliteration2}`,
        // Map the explanation/couplet beautifully, converting line breaks if any to $
        english: (raw.Translation || raw.explanation || raw.couplet || '').trim()
      };

      finalKurals.push(kural);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalKurals, null, 2), 'utf-8');
    console.log(`✅ Successfully seeded ${finalKurals.length} Kurals offline in ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

run();
