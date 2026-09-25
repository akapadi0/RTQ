import { ensureChildFolder, writeFileBufferToParent } from "../server/graph-service";
import * as store from "../server/rtq-store";
import { generateIpsPdf, ipsFileName } from "../server/pdf-generator";

async function main() {
  console.log("1) Create: single combined record (Part 1 + Part 2 + score) as one new file...");
  const created = await store.createRtqResponse({
    clientName: "Smoke Test Client",
    clientEmail: "smoketest@example.test",
    part1: {
      categoryRank: ["career", "investment", "health", "lifeChanges", "behavioral"],
      selectedConcerns: { career: ["job-loss"] },
      freeText1: "Test context",
      freeText2: "",
    },
    part2: { q1: 9, q2: 8, q3: 8, q4: 8, q5: 8, q6: 8, q7: 8 },
    resultSnapshot: { score: 57, tierLabel: "Stability", tierDescription: "Balanced.", allocationNarrative: "Balanced allocation.", computedAt: new Date().toISOString() },
  });
  console.log("   created id:", created.id, "| status:", created.status);

  console.log("2) Immediate read-back by id (no search — direct path)...");
  const fetchedImmediately = await store.getRtqResponse(created.id);
  console.log("   found immediately:", !!fetchedImmediately, "| clientName:", fetchedImmediately?.clientName);
  if (!fetchedImmediately) throw new Error("Immediate read-back failed — regression in the per-record design.");

  console.log("3) Advisor capacity update (second, later write to the same record)...");
  const withCapacity = await store.setCapacityInputs(created.id, {
    age: 40,
    targetRetirementAge: 65,
    career: "Engineer",
    investableAssets: 500000,
    incomeStability: "stable_employment",
    goalCoverage: "on_track",
    cashNeeds: [],
    notes: "smoke test",
  });
  console.log("   after capacity, status:", withCapacity.status);

  const fetched = await store.getRtqResponse(created.id);
  console.log("   fetched back clientName:", fetched?.clientName, "| status:", fetched?.status);

  console.log("4) PDF generation...");
  const pdf = await generateIpsPdf(fetched!);
  const fileName = ipsFileName(fetched!.clientName);
  console.log("   PDF bytes:", pdf.length, "| filename:", fileName);

  console.log("5) Save PDF into a per-client subfolder of the resolved Suitability folder...");
  const suitabilityFolderId = process.env.SUITABILITY_FOLDER_ID;
  if (!suitabilityFolderId) throw new Error("SUITABILITY_FOLDER_ID not set");
  const clientFolderId = await ensureChildFolder(suitabilityFolderId, fetched!.clientName);
  await writeFileBufferToParent(clientFolderId, fileName, pdf, "application/pdf");
  console.log("   saved to client folder id:", clientFolderId);

  console.log("6) listRtqResponses + compileWorkbook (audit-log export)...");
  const all = await store.listRtqResponses();
  console.log("   total records:", all.length);
  const workbook = await store.compileWorkbook();
  console.log("   compiled workbook bytes:", workbook.length);

  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
