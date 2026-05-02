import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
  } from "@react-pdf/renderer";
  
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
  
  const styles = StyleSheet.create({
    page: {
      padding: 56,
      fontSize: 10.5,
      fontFamily: "Helvetica",
      color: "#1a1a1a",
      backgroundColor: "#fbf9f4",
    },
    header: {
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: "#e8e6df",
      paddingBottom: 16,
    },
    experimentLabel: {
      fontSize: 8,
      color: "#6b6b6b",
      letterSpacing: 1.2,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    proteinName: {
      fontSize: 22,
      fontFamily: "Times-Roman",
      color: "#1a1a1a",
      marginBottom: 4,
    },
    geneSubtitle: {
      fontSize: 11,
      color: "#6b6b6b",
      fontFamily: "Helvetica",
    },
    factGrid: {
      marginBottom: 28,
    },
    factRow: {
      flexDirection: "row",
      marginBottom: 6,
    },
    factLabel: {
      width: 130,
      color: "#6b6b6b",
      fontSize: 10,
    },
    factValue: {
      flex: 1,
      fontSize: 10.5,
      color: "#1a1a1a",
    },
    factValueMuted: {
      flex: 1,
      fontSize: 10.5,
      color: "#6b6b6b",
      fontStyle: "italic",
    },
    briefingSection: {
      marginBottom: 28,
    },
    sectionHeading: {
      fontSize: 14,
      fontFamily: "Times-Roman",
      color: "#1a1a1a",
      marginBottom: 12,
    },
    paragraph: {
      fontSize: 10.5,
      lineHeight: 1.55,
      marginBottom: 10,
      color: "#1a1a1a",
    },
    footer: {
      position: "absolute",
      bottom: 36,
      left: 56,
      right: 56,
      borderTopWidth: 1,
      borderTopColor: "#e8e6df",
      paddingTop: 10,
      fontSize: 8,
      color: "#6b6b6b",
      fontStyle: "italic",
      textAlign: "center",
    },
  });
  
  export function BriefingPDF({ protein }: { protein: Protein }) {
    const generatedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  
    const paragraphs = protein.narrative
      ? protein.narrative.split("\n\n").filter((p) => p.trim().length > 0)
      : [];
  
    return (
      <Document
        title={`Foldspace · ${protein.gene ?? protein.id}`}
        author="Foldspace · Floviken"
      >
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.experimentLabel}>
              Foldspace · a Floviken experiment
            </Text>
            <Text style={styles.proteinName}>{protein.name ?? protein.id}</Text>
            <Text style={styles.geneSubtitle}>
              {protein.gene ? `${protein.gene} · ${protein.id}` : protein.id}
              {"  ·  "}
              Generated {generatedDate}
            </Text>
          </View>
  
          <View style={styles.factGrid}>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>UniProt ID</Text>
              <Text style={styles.factValue}>{protein.id}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Gene</Text>
              <Text style={styles.factValue}>{protein.gene ?? "—"}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Organism</Text>
              <Text style={styles.factValueMuted}>{protein.organism ?? "—"}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Length</Text>
              <Text style={styles.factValue}>
                {protein.length ? `${protein.length} aa` : "—"}
              </Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Status</Text>
              <Text style={styles.factValue}>
                {protein.reviewed ? "Reviewed (Swiss-Prot)" : "Unreviewed (TrEMBL)"}
              </Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Mean pLDDT</Text>
              <Text style={styles.factValue}>
                {protein.alphaFold.available && protein.alphaFold.meanPlddt !== null
                  ? `${protein.alphaFold.meanPlddt} · ${protein.alphaFold.confidenceLabel}`
                  : "Not available"}
              </Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Approved drugs</Text>
              <Text style={styles.factValue}>
                {protein.chembl.available
                  ? protein.chembl.approvedDrugs.length > 0
                    ? protein.chembl.approvedDrugs.join(", ")
                    : "None known to ChEMBL"
                  : "Not available"}
              </Text>
            </View>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Bioactivity records</Text>
              <Text style={styles.factValue}>
                {protein.chembl.available && protein.chembl.totalCompounds !== null
                  ? protein.chembl.totalCompounds.toLocaleString()
                  : "Not available"}
              </Text>
            </View>
          </View>
  
          {paragraphs.length > 0 && (
            <View style={styles.briefingSection}>
              <Text style={styles.sectionHeading}>Clinical briefing</Text>
              {paragraphs.map((paragraph, i) => (
                <Text key={i} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          )}
  
          <Text style={styles.footer} fixed>
            Synthesized by Claude from UniProt, AlphaFold, and ChEMBL.
            Demonstration only — not a clinical decision tool.
            foldspace.floviken.se
          </Text>
        </Page>
      </Document>
    );
  }