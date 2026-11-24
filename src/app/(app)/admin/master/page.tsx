import { getMasterData } from "@/server/actions/master";
import { MasterDataClient } from "@/components/admin/master-data-client";
import { requireRolePage } from "@/lib/auth-guard";

export default async function AdminMasterPage() {
  await requireRolePage(["ADMIN"]);
  const { departments, locations, pmTypes, inspectionTypes } =
    await getMasterData();

  return (
    <MasterDataClient
      departments={departments}
      locations={locations}
      pmTypes={pmTypes}
      inspectionTypes={inspectionTypes}
    />
  );
}
