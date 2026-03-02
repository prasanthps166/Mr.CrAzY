import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase";

type CommunityPostRouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: CommunityPostRouteContext) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase service role key is missing" }, { status: 500 });
  }

  const { data: post } = await supabase.from("community_posts").select("*").eq("id", params.id).maybeSingle();
  if (!post) {
    return NextResponse.json({ message: "Post not found" }, { status: 404 });
  }

  const [{ data: generation }, { data: user }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, generated_image_url, prompt_id")
      .eq("id", post.generation_id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .eq("id", post.user_id)
      .maybeSingle(),
  ]);

  if (!generation || !user) {
    return NextResponse.json({ message: "Post data is incomplete" }, { status: 404 });
  }

  const { data: prompt } = await supabase
    .from("prompts")
    .select("id, title, description, category")
    .eq("id", generation.prompt_id)
    .maybeSingle();

  if (!prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({
    post: {
      id: post.id,
      likes: post.likes,
      created_at: post.created_at,
      generation_id: post.generation_id,
      prompt_id: prompt.id,
      prompt_title: prompt.title,
      prompt_description: prompt.description,
      prompt_category: prompt.category,
      generated_image_url: generation.generated_image_url,
      user_id: post.user_id,
      username: user.full_name ?? "Anonymous",
      user_avatar_url: user.avatar_url,
    },
  });
}
