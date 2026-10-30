import "dotenv/config";
import { HtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });

  eleventyConfig.addGlobalData("appConfig", {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || ""
  });

  eleventyConfig.addFilter("json", (value) => JSON.stringify(value).replace(/</g, "\\u003c"));

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html"]
  };
}
