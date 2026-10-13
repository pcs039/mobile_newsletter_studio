"use client";
import { useState } from "react";
import type { ProjectContentArticle,ProjectContentBlock } from "@/lib/newsletter-repository";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import { getValidArticleActionHref,getArticleLinkButtonLabel } from "@/lib/public-article-url";
export type FullLayoutArticleContent=Pick<ProjectContentArticle,"title"|"summary"|"body"|"blocks"|"publicInfo"|"articleType"|"links"> & {id?:string};
export function ArticleFullLayout({article,block,onFailure,onOpenImage}:{article:FullLayoutArticleContent;block:ProjectContentBlock;onFailure?:()=>void;onOpenImage?:(image:{src:string;alt:string})=>void}){
 const [failed,setFailed]=useState(false);
 const paragraphs=article.blocks.filter(b=>b.type==="paragraph"&&b.isVisible);
 return <section className="min-w-0 [overflow-wrap:anywhere]" aria-label="Canva 기사">
   <h2 className="sr-only">{article.title}</h2>
   {!failed?<button type="button" className="block w-full" aria-label={`${article.title} 이미지 확대 보기`} onClick={()=>onOpenImage?.({src:block.body,alt:article.title})}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={block.body} alt={`${article.title} 안내 이미지`} className="block h-auto w-full object-contain" onError={()=>{setFailed(true);onFailure?.();}} />
   </button>:<p role="status">이미지를 불러오지 못했습니다. 텍스트로 내용을 확인하세요.</p>}
   <div className="mt-3 flex flex-wrap gap-2">{article.links.filter(l=>l.isVisible).map(l=>{const href=getValidArticleActionHref(l.targetValue,l.actionType);return href?<a key={l.id} href={href.href} className="dd-btn dd-btn-primary max-w-full [overflow-wrap:anywhere]" style={{whiteSpace:"normal"}} target={href.actionType==="phone"?undefined:"_blank"} rel="noopener noreferrer" data-article-id={article.id} data-article-action="button" data-action-type={href.actionType} data-link-action-id={l.id}>{getArticleLinkButtonLabel(l.label,href.actionType)}</a>:null;})}</div>
   <details className="mt-4 rounded-lg border p-3" open={failed||undefined}><summary className="cursor-pointer font-bold">텍스트로 읽기</summary><div className="mt-3"><PublicTextSizeToggle compact/><h3 data-public-text-scale-target="article-body" className="public-article-title mt-3 font-bold">{article.title}</h3>{article.summary?<p data-public-text-scale-target="article-summary" className="mt-2 whitespace-pre-wrap">{article.summary}</p>:null}
     <dl className="mt-3">{getArticlePublicInfoEntries(article.publicInfo,article.articleType).map(f=><div key={f.key} className="mt-2"><dt className="font-bold">{f.label}</dt><dd data-public-text-scale-target="article-body">{f.value}</dd></div>)}</dl>
     {paragraphs.length?paragraphs.map(p=><div key={p.id} className="mt-3">{p.title?<h4 data-public-text-scale-target="article-body" className="font-bold">{p.title}</h4>:null}<p data-public-text-scale-target="article-body" className="public-article-body whitespace-pre-wrap">{p.body}</p></div>):<p data-public-text-scale-target="article-body" className="public-article-body mt-3 whitespace-pre-wrap">{article.body}</p>}
   </div></details>
 </section>;
}
