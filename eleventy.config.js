import MarkdownIt from "markdown-it";
import EleventyWebCPlugin from "@11ty/eleventy-plugin-webc";

const markdown = new MarkdownIt({ html: true, linkify: true });

export default function (eleventyConfig) {
  eleventyConfig.setLibrary("md", markdown);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPlugin(EleventyWebCPlugin, { components: ["src/_includes/components/**/*.webc"], useTransform: true });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk"
  };
}
