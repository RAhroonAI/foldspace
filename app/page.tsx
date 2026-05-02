"use client";

import { useState } from "react";

type Protein = {
  id: string;
  name: string | null;
  gene: string | null;
  organism: string | null;
  length: number | null;
  reviewed: boolean;
  alphaFold: {
    meanPlddt: number | null;
    confidenceLabel: string;
    available: boolean;
  };
  chembl: {
    targetId: string | null;
    approvedDrugs: string[];
    totalCompounds: number | null;
    available: boolean;
  };
  narrative: string | null;
};

const PRESET_TARGETS: { gene: string; id: string }[] = [
  { gene: "TP53", id: "P04637" },
  { gene: "EGFR", id: "P00533" },
  { gene: "KRAS", id: "P01116" },
  { gene: "BRCA1", id: "P38398" },
  { gene: "INS", id: "P01308" },
  { gene: "HBB", id: "P68871" },
  { gene: "PCSK9", id: "Q8NBP7" },
  { gene: "GLP1R", id: "P43220" },
  { gene: "BTK", id: "Q06187" },
  { gene: "JAK2", id: "O60674" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [protein, setProtein] = useState<Protein | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(idToSearch: string) {
    const trimmed = idToSearch.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setProtein(null);

    try {
      const response = await fetch(`/api/uniprot?id=${trimmed}`);

      if (!response.ok) {
        setError("Could not find that protein. Check the UniProt accession and try again.");
        return;
      }

      const data = await response.json();
      setProtein(data);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleManualSearch() {
    runSearch(input);
  }

  function handleChipClick(target: { gene: string; id: string }) {
    setInput(target.id);
    runSearch(target.id);
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-fv-muted tracking-wide mb-3">
          Foldspace · a Floviken experiment
        </p>
        <h1 className="font-serif text-4xl font-medium mb-4">Foldspace</h1>
        <p className="text-fv-muted leading-relaxed mb-2">
          Reading a paper, hearing about a new drug target, trying to recall what a protein does in normal physiology — clinicians often need fast context that isn&apos;t pitched at researchers.
        </p>
        <p className="text-fv-muted leading-relaxed mb-10">
          Foldspace fetches live data from UniProt, AlphaFold, and ChEMBL and asks Claude to write a short clinical briefing on top of it. The facts come from databases; the language comes from Claude.
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            placeholder="Enter UniProt ID (e.g. P04637)"
            className="flex-1 px-4 py-2 border border-fv-border bg-fv-card rounded text-fv-text placeholder:text-fv-muted focus:outline-none focus:border-fv-accent"
          />
          <button
            onClick={handleManualSearch}
            disabled={loading}
            className="px-5 py-2 bg-fv-text text-fv-bg rounded disabled:opacity-50 font-medium"
          >
            {loading ? "Loading…" : "Search"}
          </button>
        </div>

        <div className="mb-12">
          <p className="text-xs text-fv-muted tracking-wide mb-3">Common targets</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TARGETS.map((target) => (
              <button
                key={target.id}
                onClick={() => handleChipClick(target)}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-mono border border-fv-border bg-fv-card rounded hover:border-fv-accent hover:text-fv-accent transition-colors disabled:opacity-50"
              >
                {target.gene}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p className="text-fv-muted italic">
            Fetching protein data, structural confidence, bioactivity, and generating briefing…
          </p>
        )}

        {error && <p className="text-red-700">{error}</p>}

        {protein && (
          <div className="space-y-8">
            <div className="border border-fv-border bg-fv-card rounded p-8">
              <h2 className="font-serif text-2xl font-medium mb-6">{protein.name}</h2>
              <dl className="grid grid-cols-[180px_1fr] gap-y-3 text-sm">
                <dt className="text-fv-muted">UniProt ID</dt>
                <dd className="font-mono">{protein.id}</dd>
                <dt className="text-fv-muted">Gene</dt>
                <dd className="font-mono">{protein.gene ?? "—"}</dd>
                <dt className="text-fv-muted">Organism</dt>
                <dd className="italic">{protein.organism ?? "—"}</dd>
                <dt className="text-fv-muted">Length</dt>
                <dd>{protein.length ? `${protein.length} aa` : "—"}</dd>
                <dt className="text-fv-muted">Status</dt>
                <dd>{protein.reviewed ? "Reviewed (Swiss-Prot)" : "Unreviewed (TrEMBL)"}</dd>
                <dt className="text-fv-muted">Mean pLDDT</dt>
                <dd>
                  {protein.alphaFold.available && protein.alphaFold.meanPlddt !== null ? (
                    <>
                      <span className="font-mono">{protein.alphaFold.meanPlddt}</span>
                      <span className="text-fv-muted"> · {protein.alphaFold.confidenceLabel}</span>
                    </>
                  ) : (
                    <span className="text-fv-muted">Not available</span>
                  )}
                </dd>
                <dt className="text-fv-muted">Approved drugs</dt>
                <dd>
                  {protein.chembl.available ? (
                    protein.chembl.approvedDrugs.length > 0 ? (
                      protein.chembl.approvedDrugs.join(", ")
                    ) : (
                      <span className="text-fv-muted">None known to ChEMBL</span>
                    )
                  ) : (
                    <span className="text-fv-muted">Not available</span>
                  )}
                </dd>
                <dt className="text-fv-muted">Bioactivity records</dt>
                <dd>
                  {protein.chembl.available && protein.chembl.totalCompounds !== null ? (
                    <span className="font-mono">{protein.chembl.totalCompounds.toLocaleString()}</span>
                  ) : (
                    <span className="text-fv-muted">Not available</span>
                  )}
                </dd>
              </dl>
            </div>

            {protein.narrative && (
              <div className="border border-fv-border bg-fv-card rounded p-8">
                <h3 className="font-serif text-xl font-medium mb-5">Clinical briefing</h3>
                <div className="leading-relaxed space-y-4 text-fv-text">
                  {protein.narrative.split("\n\n").map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
                <p className="text-xs text-fv-muted mt-6 italic border-t border-fv-border pt-4">
                  Synthesized by Claude from UniProt, AlphaFold, and ChEMBL data. Demonstration only — not a clinical decision tool.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}