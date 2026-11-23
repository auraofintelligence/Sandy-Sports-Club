// Versioned Sandy Sports production guidance. Resolutions are export presets, not universal upload requirements.
// Review the destination's native placement preview before publishing or approving paid ads.
// Live Straddie Noticeboard outlet formats are web, tv and kiosk; paid inventory and video are proposals only.
export const CREATIVE_SPEC_VERSION=Object.freeze({
  id:'2026-11-23.2',reviewedOn:'2026-11-23',
  policy:'Working export presets, not upload minimums. Recheck official placement specs before buying ads.'
});
export const PUBLISHING_DESTINATIONS=Object.freeze([
  {id:'facebook',label:'Facebook',status:'existing'},
  {id:'instagram',label:'Instagram',status:'existing'},
  {id:'youtube',label:'YouTube',status:'existing'},
  {id:'tiktok',label:'TikTok',status:'existing'},
  {id:'noticeboard',label:'Straddie Noticeboard Network',status:'proposed',publicUrl:'https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/'}
]);
export const MASTER_ASSET_PRESETS=Object.freeze([
  {id:'vertical-short',label:'Vertical short video',width:1080,height:1920,ratio:'9:16',media:'video'},
  {id:'premium-vertical-ad',label:'Premium Meta vertical advertisement',width:1440,height:2560,ratio:'9:16',media:'video'},
  {id:'premium-meta-feed',label:'Premium Meta Feed image or video',width:1440,height:1800,ratio:'4:5',media:'both'},
  {id:'instagram-organic-photo',label:'Organic Instagram portrait photo',width:1080,height:1440,ratio:'3:4',media:'image'},
  {id:'square-carousel',label:'Square image carousel',width:1080,height:1080,ratio:'1:1',media:'image'},
  {id:'widescreen-video',label:'Widescreen video',width:1920,height:1080,ratio:'16:9',media:'video'},
  {id:'youtube-video-thumbnail',label:'YouTube standard-video thumbnail',width:3840,height:2160,ratio:'16:9',media:'image'},
  {id:'youtube-shorts-thumbnail',label:'YouTube Shorts thumbnail',width:2160,height:3840,ratio:'9:16',media:'image'}
]);
export const placementSources=Object.freeze({
  meta:'https://www.facebook.com/business/ads-guide',
  metaCrossCheck:'https://tofuads.com/resources/meta-ad-sizes-safe-zones-feed-stories-reels-b2b',
  youtube:'https://support.google.com/youtube/answer/15424877?hl=en',
  youtubeThumbnails:'https://support.google.com/youtube/answer/72431?hl=en',
  googleAds:'https://support.google.com/google-ads/answer/13547298?hl=en',
  tiktok:'https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?lang=en-GB',
  tiktokCarousel:'https://ads.tiktok.com/resources/help/article/specifications-for-carousel-ads?lang=en',
  noticeboard:'https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/how-it-works.html'
});
// Meta full-screen 9:16: intentionally conservative text/logo clearances, not a platform guarantee.
const metaSafe=Object.freeze({top:.14,bottom:.35,sides:.06,label:'Conservative text/logo safe-zone guide; verify in Meta placement preview'});
const platformSafe=Object.freeze({label:'Review caption, icons and CTA overlays in the native placement preview'});
const candidate=(id,platform,placement,distribution,kind,width,height,ratio,more={})=>Object.freeze({
  id,platform,placement,distribution,kind,width,height,ratio,
  sourceKey:platform==='noticeboard'?'noticeboard':platform==='youtube'?'googleAds':platform==='tiktok'?'tiktok':'meta',
  reviewOn:'2026-11-23',fileFormats:kind==='image'||kind==='poster'?['JPG','PNG']:['MP4','MOV'],
  safeZone:platformSafe,provisional:false,note:'Production preset; verify actual placement requirements.',
  ...more
});
export const CREATIVE_PRESETS=Object.freeze([
  candidate('facebook-feed','facebook','Feed organic image or video','organic','both',1080,1350,'4:5',
    {note:'Common optional organic Feed export, not a mandatory or paid-only format.'}),
  candidate('facebook-reels','facebook','Reels / Stories','organic','video',1080,1920,'9:16',
    {safeZone:metaSafe,note:'Full-screen vertical; inspect caption and controls before posting.'}),
  candidate('facebook-feed-ad','facebook','Feed image/video ad','paid','both',1440,1800,'4:5',
    {note:'Recommended Meta Feed advertising export; approval before spending.'}),
  candidate('facebook-reels-ad','facebook','Reels / Stories ad','paid','video',1440,2560,'9:16',
    {safeZone:metaSafe,note:'9:16 paid Meta ad export; review safe zones and preview.'}),
  candidate('facebook-carousel-ad','facebook','Feed image carousel ad','paid','image',1080,1080,'1:1',
    {note:'Square carousel artwork; check actual card count and CTA in Ads Manager.'}),

  candidate('instagram-feed','instagram','Feed organic image or video','organic','both',1080,1350,'4:5',
    {note:'Common Feed production preset; other organic ratios can be used.'}),
  candidate('instagram-photo-3x4','instagram','Feed photo, portrait 3:4','organic','image',1080,1440,'3:4',
    {note:'Optional native 3:4 organic portrait photo.'}),
  candidate('instagram-reels','instagram','Reels / Stories','organic','video',1080,1920,'9:16',
    {safeZone:metaSafe,note:'Vertical original, subtitles and placement-safe titles.'}),
  candidate('instagram-feed-image-ad','instagram','Feed image advertisement','paid','image',1440,1800,'4:5',
    {note:'4:5 Feed image-ad recommendation; differs from Feed video-ad recommendation.'}),
  candidate('instagram-feed-video-ad','instagram','Feed video advertisement','paid','video',1080,1920,'9:16',
    {safeZone:metaSafe,note:'Meta Ads Guide Feed video ad recommendation: 9:16, distinct from 4:5 Feed image ads.'}),
  candidate('instagram-reels-ad','instagram','Reels / Stories video ad','paid','video',1440,2560,'9:16',
    {safeZone:metaSafe,note:'High-resolution vertical ad production; captions and rights review.'}),
  candidate('instagram-carousel-ad','instagram','Feed image carousel ad','paid','image',1080,1080,'1:1',
    {note:'Square carousel artwork; verify creative slots for the selected Meta objective.'}),

  candidate('youtube-shorts','youtube','Shorts','organic','video',1080,1920,'9:16',
    {durationMaxSeconds:180,thumbnailPreset:'youtube-shorts-thumbnail',
      sourceKey:'youtube',note:'Organic Shorts allow up to three minutes; 30 seconds remains the Sandy Sports default.'}),
  candidate('youtube-standard','youtube','Standard long-form video','organic','video',1920,1080,'16:9',
    {thumbnailPreset:'youtube-video-thumbnail',sourceKey:'youtubeThumbnails',
      note:'Produce a real landscape edit and accompanying 3840 × 2160 thumbnail.'}),
  candidate('youtube-shorts-ad','youtube','Shorts video ad','paid','video',1080,1920,'9:16',
    {recommendedDurationSeconds:30,thumbnailPreset:'youtube-shorts-thumbnail',sourceKey:'googleAds',
      note:'Short, purposeful paid creative; 30 seconds is a creative target, not an upload limit.'}),
  candidate('youtube-instream-ad','youtube','In-stream landscape video ad','paid','video',1920,1080,'16:9',
    {recommendedDurationSeconds:30,sourceKey:'googleAds',thumbnailPreset:'youtube-video-thumbnail',
      note:'Different campaign products have different duration and skip conditions.'}),

  candidate('tiktok-feed','tiktok','Organic vertical video','organic','video',1080,1920,'9:16',
    {note:'Vertical original; include clear on-screen captions and sound-off comprehension.'}),
  candidate('tiktok-carousel','tiktok','Organic photo carousel','organic','image',1080,1920,'9:16',
    {note:'Optional high-resolution vertical photo slides, not paid-carousel technical specifications.'}),
  candidate('tiktok-infeed-ad','tiktok','Auction in-feed video ad','paid','video',1080,1920,'9:16',
    {durationMaxSeconds:600,maxFileMB:500,sourceKey:'tiktok',
      note:'Working export exceeds 540 × 960 Non-Spark minimum; check dynamic TikTok safe zone.'}),
  candidate('tiktok-standard-carousel-ad','tiktok','Standard vertical Carousel ad','paid','image',720,1280,'9:16',
    {carousel:{min:2,max:35,requiresMusic:true},fileFormats:['JPG','PNG'],sourceKey:'tiktokCarousel',
      note:'TikTok Standard Carousel vertical specification, not the organic photo carousel.'}),

  candidate('noticeboard-web','noticeboard','Web/mobile responsive notice','organic','poster',1200,630,'responsive',
    {provisional:true,note:'Proposed source artwork; responsive live board does not mandate one image dimension.'}),
  candidate('noticeboard-tv','noticeboard','Venue/onboard landscape notice','organic','poster',1920,1080,'16:9',
    {provisional:true,note:'Proposed still adaptation for 16:9 displays; no live video delivery.'}),
  candidate('noticeboard-kiosk','noticeboard','Touchscreen portrait notice','organic','poster',1080,1920,'9:16',
    {provisional:true,note:'Proposed still adaptation for 9:16 kiosks; no live video delivery.'}),
  candidate('noticeboard-web-ad','noticeboard','Proposed sponsored web notice','paid','poster',1200,630,'responsive',
    {provisional:true,note:'Requires advertising inventory, pricing, disclosure and human notice approval.'}),
  candidate('noticeboard-tv-ad','noticeboard','Proposed sponsored TV notice','paid','poster',1920,1080,'16:9',
    {provisional:true,note:'Still-ad concept only; no purchased slots, screen-video playback or automation.'}),
  candidate('noticeboard-kiosk-ad','noticeboard','Proposed sponsored kiosk notice','paid','poster',1080,1920,'9:16',
    {provisional:true,note:'Still-ad concept only; requires host and publisher approval.'})
]);
const isVideo=post=>Number(post.durationSeconds)>0;
export function creativeVariantsFor(post,delivery={}){
  const video=isVideo(post);
  const organic=delivery.organic||['facebook','instagram','youtube','tiktok','noticeboard'];
  const paid=delivery.paid||[];
  const paidPlanning=Boolean(delivery.paidPlanning);
  return CREATIVE_PRESETS.filter(p=>{
    const selected=p.distribution==='organic'?organic.includes(p.platform):paidPlanning&&paid.includes(p.platform);
    const suitable=p.kind==='poster'||p.kind==='both'||(video?p.kind==='video':p.kind==='image');
    return selected&&suitable;
  }).map(p=>{
    const asset=p.kind==='poster'?'Still-image adaptation':p.kind==='image'?'Image / carousel':video?'Video':'Image';
    const fileFormats=p.kind==='both'&&!video?['JPG','PNG']:p.fileFormats;
    const safeZone=p.safeZone&&Number.isFinite(p.safeZone.top)?{
      topPercent:Math.round(p.safeZone.top*100),bottomPercent:Math.round(p.safeZone.bottom*100),
      sidePercent:Math.round(p.safeZone.sides*100),
      topPixels:Math.ceil(p.height*p.safeZone.top),bottomPixels:Math.ceil(p.height*p.safeZone.bottom),
      sidePixels:Math.ceil(p.width*p.safeZone.sides),label:p.safeZone.label
    }:{label:p.safeZone.label};
    const thumb=MASTER_ASSET_PRESETS.find(t=>t.id===p.thumbnailPreset);
    return {
      id:p.id,platform:p.platform,placement:p.placement,distribution:p.distribution,
      width:p.width,height:p.height,ratio:p.ratio,size:p.width+' × '+p.height,
      asset,provisional:Boolean(p.provisional),note:p.note,
      specVersion:CREATIVE_SPEC_VERSION.id,reviewedOn:p.reviewOn,sourceUrl:placementSources[p.sourceKey],
      fileFormats,maximumDurationSeconds:p.durationMaxSeconds??null,
      recommendedDurationSeconds:p.recommendedDurationSeconds??(video?30:null),
      maxFileMB:p.maxFileMB??null,carousel:p.carousel||null,safeZone,
      thumbnail:thumb?{label:thumb.label,width:thumb.width,height:thumb.height,ratio:thumb.ratio}:null,
      checklist:video?['Master footage','Platform-specific edit','Captions/subtitles','Sound/music rights','Safe zone and CTA preview','Thumbnail if supported','Final approval']:
        ['Original artwork','Platform-specific crop','Legible text and alt text','Image rights','CTA and link check','Final approval'],
      approval:p.distribution==='paid'?'Requires explicit ad budget, targeting and launch approval':'Editorial approval before posting',
      status:p.distribution==='paid'?'Unapproved paid creative':'Organic creative suggestion'
    };
  });
}
