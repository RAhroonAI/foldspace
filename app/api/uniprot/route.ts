import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const REQUEST_HEADERS = {
  "User-Agent": "Foldspace/0.1 (a Floviken experiment; richard@floviken.se)",
  "Accept": "application/json",
};

type AlphaFoldData = {
  meanPlddt: number | null;
  confidenceLabel: string;
  available: boolean;
};

type ChEMBLData = {
  targetId: string | null;
  approvedDrugs: string[];
  totalCompounds: number | null;
  available: boolean;
};

const SALT_SUFFIXES = [
  " hydrochloride", " mesylate", " maleate", " citrate", " sulfate",
  " sulphate", " phosphate", " tartrate", " ditosylate", " tosylate",
  " dimaleate", " fumarate", " succinate", " acetate", " hydrobromide",
  " hydrate", " anhydrous", " sodium", " potassium", " calcium",
];

function normalizeDrugName(raw: string): string {
  const titleCased = raw.charAt(0) + raw.slice(1).toLowerCase();
  let stripped = titleCased;
  for (const suffix of SALT_SUFFIXES) {
    if (stripped.toLowerCase().endsWith(suffix)) {
      stripped = stripped.slice(0, -suffix.length);
      break;
    }
  }
  return stripped.trim();
}

function summarizePlddt(values: number[]): AlphaFoldData {
  if (!values || values.length === 0) {
    return { meanPlddt: null, confidenceLabel: "Not available", available: false };
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const rounded = Math.round(mean * 10) / 10;
  let label: string;
  if (mean >= 90) label = "Very high confidence overall";
  else if (mean >= 70) label = "Confident overall";
  else if (mean >= 50) label = "Mixed confidence — disordered regions present";
  else label = "Low confidence — likely highly disordered";
  return { meanPlddt: rounded, confidenceLabel: label, available: true };
}

function parsePlddtFromPdb(pdbText: string): number[] {
  const scores: number[] = [];
  const lines = pdbText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("ATOM")) continue;
    const atomName = line.substring(12, 16).trim();
    if (atomName !== "CA") continue;
    const bFactor = parseFloat(line.substring(60, 66).trim());
    if (!isNaN(bFactor)) scores.push(bFactor);
  }
  return scores;
}

async function fetchAlphaFold(uniprotId: string): Promise<AlphaFoldData> {
  const notAvailable = { meanPlddt: null, confidenceLabel: "Not available", available: false };
  const id = uniprotId.toUpperCase();
  try {
    const metaResponse = await fetch(
      `https://alphafold.ebi.ac.uk/api/prediction/${id}`,
      { headers: REQUEST_HEADERS }
    );
    if (!metaResponse.ok) return notAvailable;
    const metaData = await metaResponse.json();
    const entry = metaData?.[0];
    if (!entry) return notAvailable;
    const pdbUrl: string | undefined = entry.pdbUrl;
    if (!pdbUrl) return notAvailable;
    const pdbResponse = await fetch(pdbUrl, { headers: REQUEST_HEADERS });
    if (!pdbResponse.ok) return notAvailable;
    const pdbText = await pdbResponse.text();
    const scores = parsePlddtFromPdb(pdbText);
    return summarizePlddt(scores);
  } catch {
    return notAvailable;
  }
}

async function fetchChEMBL(uniprotId: string): Promise<ChEMBLData> {
  const notAvailable: ChEMBLData = {
    targetId: null,
    approvedDrugs: [],
    totalCompounds: null,
    available: false,
  };

  const id = uniprotId.toUpperCase();

  try {
    const targetUrl = `https://www.ebi.ac.uk/chembl/api/data/target.json?target_components__accession=${id}&target_type=SINGLE+PROTEIN`;
    const targetResponse = await fetch(targetUrl, { headers: REQUEST_HEADERS });
    if (!targetResponse.ok) return notAvailable;

    const targetData = await targetResponse.json();
    const targetId: string | undefined = targetData?.targets?.[0]?.target_chembl_id;
    if (!targetId) return notAvailable;

    const mechanismUrl = `https://www.ebi.ac.uk/chembl/api/data/mechanism.json?target_chembl_id=${targetId}&limit=1000`;
    const activityUrl = `https://www.ebi.ac.uk/chembl/api/data/activity.json?target_chembl_id=${targetId}&limit=1`;

    const [mechanismResponse, activityResponse] = await Promise.all([
      fetch(mechanismUrl, { headers: REQUEST_HEADERS }),
      fetch(activityUrl, { headers: REQUEST_HEADERS }),
    ]);

    let approvedDrugs: string[] = [];
    if (mechanismResponse.ok) {
      const mechanismData = await mechanismResponse.json();
      const mechs: { molecule_chembl_id?: string }[] = mechanismData?.mechanisms ?? [];
      const moleculeIds = Array.from(
        new Set(mechs.map((m) => m.molecule_chembl_id).filter((x): x is string => !!x))
      );

      if (moleculeIds.length > 0) {
        const idList = moleculeIds.slice(0, 50).join(",");
        const moleculeUrl = `https://www.ebi.ac.uk/chembl/api/data/molecule.json?molecule_chembl_id__in=${idList}&limit=50`;
        const moleculeResponse = await fetch(moleculeUrl, { headers: REQUEST_HEADERS });

        if (moleculeResponse.ok) {
          const moleculeData = await moleculeResponse.json();
          const molecules: {
            pref_name?: string | null;
            max_phase?: number | string | null;
          }[] = moleculeData?.molecules ?? [];

          const allNames = molecules
            .filter((m) => {
              if (!m.pref_name) return false;
              const phase = typeof m.max_phase === "string" ? parseFloat(m.max_phase) : m.max_phase;
              return phase !== null && phase !== undefined && !isNaN(phase as number) && (phase as number) >= 4;
            })
            .map((m) => normalizeDrugName(m.pref_name as string));

          approvedDrugs = Array.from(new Set(allNames)).sort();
        }
      }
    }

    let totalCompounds: number | null = null;
    if (activityResponse.ok) {
      const activityData = await activityResponse.json();
      totalCompounds = activityData?.page_meta?.total_count ?? null;
    }

    return {
      targetId,
      approvedDrugs,
      totalCompounds,
      available: true,
    };
  } catch {
    return notAvailable;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const upperId = id.toUpperCase();

  const [uniprotResponse, alphaFold, chembl] = await Promise.all([
    fetch(`https://rest.uniprot.org/uniprotkb/${upperId}.json`, { headers: REQUEST_HEADERS }),
    fetchAlphaFold(upperId),
    fetchChEMBL(upperId),
  ]);

  if (!uniprotResponse.ok) {
    return Response.json(
      { error: "UniProt request failed" },
      { status: uniprotResponse.status }
    );
  }

  const data = await uniprotResponse.json();

  const cleaned = {
    id: data.primaryAccession,
    name: data.proteinDescription?.recommendedName?.fullName?.value ?? null,
    gene: data.genes?.[0]?.geneName?.value ?? null,
    organism: data.organism?.scientificName ?? null,
    length: data.sequence?.length ?? null,
    reviewed: data.entryType?.includes("Swiss-Prot") ?? false,
  };

  const structuralLine = alphaFold.available
    ? `- AlphaFold mean pLDDT: ${alphaFold.meanPlddt} (${alphaFold.confidenceLabel})`
    : `- AlphaFold structural data: not available`;

  const drugLine = chembl.available
    ? chembl.approvedDrugs.length > 0
      ? `- Approved drugs targeting this protein (per ChEMBL): ${chembl.approvedDrugs.join(", ")}`
      : `- ChEMBL: no approved drugs known to directly target this protein`
    : `- ChEMBL data: not available`;

  const compoundLine = chembl.available && chembl.totalCompounds !== null
    ? `- Total compounds with measured bioactivity (ChEMBL): ${chembl.totalCompounds.toLocaleString()}`
    : `- ChEMBL bioactivity count: not available`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `You are writing a brief clinical briefing for a practicing physician — an internist or hospitalist — about a drug target. Be concise, clinically grounded, and avoid speculation.

Here is the protein, fetched from UniProt, AlphaFold, and ChEMBL:

- UniProt ID: ${cleaned.id}
- Name: ${cleaned.name}
- Gene: ${cleaned.gene}
- Organism: ${cleaned.organism}
- Length: ${cleaned.length} amino acids
- Status: ${cleaned.reviewed ? "Reviewed (Swiss-Prot)" : "Unreviewed (TrEMBL)"}
${structuralLine}
${drugLine}
${compoundLine}

Write the briefing in four short paragraphs:

(1) Function — what this protein does in normal physiology, in 2–4 sentences.

(2) Clinical relevance — what diseases or conditions it's associated with. 2–4 sentences.

(3) Therapeutic landscape — explicitly use the ChEMBL data above. If approved drugs are listed, name them and briefly describe their drug class and clinical use (e.g., "EGFR tyrosine kinase inhibitors used in non-small cell lung cancer"). If no approved drugs are listed but bioactivity data exists, note that the target has been investigated. If no ChEMBL data is available, say so briefly. Use ONLY the drug names in the data above — do not invent additional drugs. 2–4 sentences.

(4) Structural confidence — explain in plain language what the AlphaFold pLDDT score means for this protein and what it implies for druggability. The reader is a clinician and may not know that pLDDT measures AlphaFold's per-residue confidence (0–100), so define it briefly the first time you mention it. Note that scores >90 are very high confidence, 70–90 confident, 50–70 suggest flexible or disordered regions, and <50 suggest intrinsic disorder. Connect the score to whether this protein is structurally amenable to drug design. 2–4 sentences. If structural data is not available, say so briefly and move on.

Hard rules: Do not invent specific drug names, trial numbers, or statistics not provided in the data above. Plain prose, no headers, no bullets. Separate paragraphs with a blank line.`,
      },
    ],
  });

  const narrative =
    message.content[0].type === "text" ? message.content[0].text : null;

  return Response.json({
    ...cleaned,
    alphaFold,
    chembl,
    narrative,
  });
}