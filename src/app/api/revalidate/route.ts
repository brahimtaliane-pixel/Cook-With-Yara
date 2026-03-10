import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const secret = request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  revalidatePath(`/recipes/${slug}`);
  revalidatePath("/recipes");
  revalidatePath("/");

  return Response.json({ revalidated: true, slug });
}
