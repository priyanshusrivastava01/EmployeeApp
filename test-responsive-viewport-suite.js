/**
 * EMS Automated Comprehensive Responsive Design & Multi-Viewport Verification Suite
 * Validates layout safety, fluid metrics, grid calculations, and viewport behavior
 * across all 14 required breakpoints:
 *   1.  320px  - Very Small Mobile
 *   2.  360px  - Small Mobile
 *   3.  375px  - Standard Android
 *   4.  390px  - Standard Mobile
 *   5.  412px  - Large Mobile
 *   6.  432px  - Large Android
 *   7.  480px  - Extra Large Mobile
 *   8.  600px  - Small Tablet
 *   9.  768px  - Tablet Portrait
 *   10. 900px  - Large Tablet
 *   11. 1024px - Small Laptop / iPad Landscape
 *   12. 1280px - Laptop
 *   13. 1440px - Desktop
 *   14. 1920px - Large Desktop
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname; // Current directory is already EmployeeApp

// Mock react-native for Node test environment
const mockReactNative = {
  useWindowDimensions: () => ({ width: 375, height: 667 }),
  PixelRatio: { getFontScale: () => 1 },
  Platform: { OS: 'android' }
};

// Evaluate responsive module functions
const responsiveModulePath = path.join(ROOT_DIR, 'mobile', 'src', 'utils', 'responsive.js');
let responsiveSource = fs.readFileSync(responsiveModulePath, 'utf8');
// Strip react-native import for pure node testing of calculations
responsiveSource = responsiveSource.replace(/import\s*\{[^}]*\}\s*from\s*['"]react-native['"];?/, '');

// Create dynamic module
const dataUri = 'data:text/javascript;base64,' + Buffer.from(responsiveSource).toString('base64');
const {
  getResponsiveMetrics,
  scaleFont,
  getGridCardWidth,
  getFeatureCardColumns,
  getActionCardColumns,
  getModalWidth
} = await import(dataUri);

console.log('======================================================================');
console.log('   EMS COMPREHENSIVE RESPONSIVE DESIGN & VIEWPORT VERIFICATION SUITE   ');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: 14 Breakpoint Fluid Metrics Evaluation
// ---------------------------------------------------------------------------
console.log('--- TEST SUITE 1: 14 Target Viewport Widths Metric Engine ---');

const VIEWPORTS = [
  { width: 320,  height: 568,  name: 'Very Small Mobile (iPhone SE 1st)' },
  { width: 360,  height: 640,  name: 'Small Mobile (Galaxy A-series)' },
  { width: 375,  height: 667,  name: 'Standard Android (iPhone 8/SE 2)' },
  { width: 390,  height: 844,  name: 'Standard Mobile (iPhone 13/14)' },
  { width: 412,  height: 915,  name: 'Large Mobile (Pixel 7/8)' },
  { width: 432,  height: 960,  name: 'Large Android (Galaxy S23+)' },
  { width: 480,  height: 854,  name: 'Extra Large Mobile (Foldable)' },
  { width: 600,  height: 960,  name: 'Small Tablet (Nexus 7)' },
  { width: 768,  height: 1024, name: 'Tablet Portrait (iPad Mini/Air)' },
  { width: 900,  height: 1200, name: 'Large Tablet (Surface Pro)' },
  { width: 1024, height: 768,  name: 'Small Laptop / iPad Landscape' },
  { width: 1280, height: 800,  name: 'Laptop (13" Display)' },
  { width: 1440, height: 900,  name: 'Desktop (1440p / 24" Display)' },
  { width: 1920, height: 1080, name: 'Large Desktop (1080p FHD)' }
];

VIEWPORTS.forEach((vp, idx) => {
  const m = getResponsiveMetrics(vp.width, vp.height);
  assert(m.width === vp.width, `Viewport ${idx + 1} (${vp.width}px): width correctly mapped`);
  assert(m.screenPadding >= 12 && m.screenPadding <= 24, `Viewport ${idx + 1} (${vp.width}px): screenPadding is safe (${m.screenPadding}px)`);
  assert(m.contentWidth === vp.width - (m.screenPadding * 2), `Viewport ${idx + 1} (${vp.width}px): contentWidth is exact (${m.contentWidth}px)`);
  
  if (vp.width < 400) {
    assert(m.isNarrowMobile === true, `Viewport ${idx + 1} (${vp.width}px): correctly flagged as isNarrowMobile`);
  } else {
    assert(m.isNarrowMobile === false, `Viewport ${idx + 1} (${vp.width}px): correctly flagged as not isNarrowMobile`);
  }

  if (vp.width < 360) {
    assert(m.isVerySmallMobile === true, `Viewport ${idx + 1} (${vp.width}px): correctly flagged as isVerySmallMobile`);
  } else if (vp.width >= 600 && vp.width < 1024) {
    assert(m.isTablet === true, `Viewport ${idx + 1} (${vp.width}px): correctly flagged as isTablet`);
  } else if (vp.width >= 1024) {
    assert(m.isDesktop === true, `Viewport ${idx + 1} (${vp.width}px): correctly flagged as isDesktop`);
  }
});

// ---------------------------------------------------------------------------
// TEST SUITE 2: Fluid Typography & Readability Bounds
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Fluid Typography Readability Bounds ---');

VIEWPORTS.forEach((vp) => {
  const scaledSmall = scaleFont(12, vp.width, 10);
  const scaledBase = scaleFont(14, vp.width, 10);
  const scaledTitle = scaleFont(20, vp.width, 12);
  
  assert(scaledSmall >= 10, `${vp.name} (${vp.width}px): Small font (12px) never drops below 10px readability floor (got ${scaledSmall}px)`);
  assert(scaledBase >= 12, `${vp.name} (${vp.width}px): Base font (14px) never drops below 12px (got ${scaledBase}px)`);
  assert(scaledTitle >= 16, `${vp.name} (${vp.width}px): Title font (20px) preserves prominence (got ${scaledTitle}px)`);
});

// ---------------------------------------------------------------------------
// TEST SUITE 3: Dynamic Grid Calculation & Zero-Gutter Collision
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Adaptive Grid Column Calculation ---');

VIEWPORTS.forEach((vp) => {
  const m = getResponsiveMetrics(vp.width, vp.height);
  const cols = getFeatureCardColumns(vp.width);
  const gap = 10;
  const cardW = getGridCardWidth(m.contentWidth, cols, gap);
  
  const totalOccupied = (cardW * cols) + (gap * (cols - 1));
  assert(totalOccupied <= m.contentWidth, `${vp.name} (${vp.width}px, ${cols} cols): total occupied (${totalOccupied}px) <= content width (${m.contentWidth}px)`);
  
  if (vp.width < 400) {
    // Narrow mobile MUST use single column so cards never break words like "Leave Applicatio n"
    assert(cols === 1, `${vp.name} (${vp.width}px): uses strictly 1 column (got ${cols})`);
    assert(cardW === m.contentWidth, `${vp.name} (${vp.width}px): card spans full content width (${cardW}px === ${m.contentWidth}px)`);
    // Horizontal space occupied by icon (38) + gaps (12) + chevron (16) + card padding (28) = 94px
    const availableTextW = cardW - 94;
    assert(availableTextW >= 180, `${vp.name} (${vp.width}px): available text width (${availableTextW}px) >= 180px, completely preventing awkward word breaks`);
  } else if (vp.width >= 400 && vp.width < 600) {
    assert(cols === 2, `${vp.name} (${vp.width}px): uses 2 columns (got ${cols})`);
    assert(cardW >= 170, `${vp.name} (${vp.width}px): card width is wide enough for 2 columns (${cardW}px)`);
  } else if (vp.width >= 600 && vp.width < 900) {
    assert(cols === 3, `${vp.name} (${vp.width}px): tablet uses 3 columns (got ${cols})`);
  } else {
    assert(cols === 4, `${vp.name} (${vp.width}px): desktop/large tablet uses 4 columns (got ${cols})`);
  }

  // Also test Admin action card columns
  const actionCols = getActionCardColumns(vp.width);
  if (vp.width < 400) {
    assert(actionCols === 2, `${vp.name} (${vp.width}px): admin action cards use 2 columns (got ${actionCols})`);
  } else if (vp.width >= 400 && vp.width < 600) {
    assert(actionCols === 3, `${vp.name} (${vp.width}px): admin action cards use 3 columns (got ${actionCols})`);
  } else if (vp.width >= 600 && vp.width < 900) {
    assert(actionCols === 4, `${vp.name} (${vp.width}px): admin action cards use 4 columns (got ${actionCols})`);
  } else {
    assert(actionCols === 6, `${vp.name} (${vp.width}px): admin action cards use 6 columns (got ${actionCols})`);
  }
});

// ---------------------------------------------------------------------------
// TEST SUITE 4: Modal Viewport Bounds & Margin Safety
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Adaptive Modal Width Safety ---');

VIEWPORTS.forEach((vp) => {
  const modalW = getModalWidth(vp.width, 480);
  assert(modalW < vp.width, `${vp.name} (${vp.width}px): modal width (${modalW}px) preserves horizontal gutter margins`);
  assert(modalW <= 480, `${vp.name} (${vp.width}px): modal width clamped within max limit (${modalW}px <= 480px)`);
  if (vp.width === 320) {
    assert(modalW === 300, `320px viewport: modal width gives exact 10px safe margins (got ${modalW}px)`);
  }
});

// ---------------------------------------------------------------------------
// TEST SUITE 5: Web Dashboard CSS Breakpoints & Utilities Inspection
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: Web Dashboard Responsive CSS Validation ---');

const webCssPath = path.join(ROOT_DIR, 'web', 'src', 'index.css');
const webCss = fs.readFileSync(webCssPath, 'utf8');

const requiredCssTokens = [
  '.ems-app-layout',
  '.ems-sidebar',
  '.ems-sidebar-backdrop',
  '.ems-main-area',
  '.ems-header',
  '.ems-header-menu-btn',
  '.grid-fluid-kpi',
  '.grid-fluid-cards',
  '.modal-card-responsive',
  '.ems-page-content',
  '@media (max-width: 1024px)',
  '@media (max-width: 768px)',
  '@media (max-width: 480px)',
  '@media (max-width: 340px)',
  '@media (min-width: 1441px)'
];

requiredCssTokens.forEach((token) => {
  assert(webCss.includes(token), `web/src/index.css contains required responsive definition "${token}"`);
});

// ---------------------------------------------------------------------------
// TEST SUITE 6: Web Dashboard JSX Fluid Grid Inspection (No Overflow Bottlenecks)
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 6: Web Dashboard JSX Grid Inspection ---');

const webAppPath = path.join(ROOT_DIR, 'web', 'src', 'App.jsx');
const webAppJsx = fs.readFileSync(webAppPath, 'utf8');

assert(!webAppJsx.includes("gridTemplateColumns: 'repeat(4, 1fr)'"), 'App.jsx: Overview stat cards no longer use rigid repeat(4, 1fr)');
assert(webAppJsx.includes('className="grid-fluid-kpi"'), 'App.jsx: Overview stat cards use fluid responsive grid-fluid-kpi class');
assert(!webAppJsx.includes("minmax(360px, 1fr)"), 'App.jsx: Summary cards no longer use fixed minmax(360px, 1fr) that overflows on 320px');
assert(!webAppJsx.includes("minmax(440px, 1fr)"), 'App.jsx: Policy cards no longer use fixed minmax(440px, 1fr) that overflows on mobile');
assert(webAppJsx.includes('isMobileNavOpen'), 'App.jsx: Mobile navigation drawer state is present and active');
assert(webAppJsx.includes('ems-header-menu-btn'), 'App.jsx: Responsive hamburger menu button is present in the header');

// ---------------------------------------------------------------------------
// TEST SUITE 7: Mobile Codebase Rigid Dimensions Elimination
// ---------------------------------------------------------------------------
console.log('\n--- TEST SUITE 7: Mobile Codebase Fluid Styling Audit ---');

const homeScreenPath = path.join(ROOT_DIR, 'mobile', 'src', 'screens', 'HomeScreen.js');
const homeScreenJs = fs.readFileSync(homeScreenPath, 'utf8');
assert(!homeScreenJs.includes("width: '48.5%'"), 'HomeScreen.js: hardcoded width: 48.5% replaced with dynamic cardWidth');
assert(homeScreenJs.includes('useResponsiveLayout'), 'HomeScreen.js: integrates useResponsiveLayout hook');
assert(homeScreenJs.includes('getGridCardWidth'), 'HomeScreen.js: dynamically computes grid card width');
assert(homeScreenJs.includes('getFeatureCardColumns'), 'HomeScreen.js: uses content-aware getFeatureCardColumns');
assert(homeScreenJs.includes('numberOfLines={1}'), 'HomeScreen.js: gridTitle and gridDesc protected with numberOfLines={1}');
assert(homeScreenJs.includes('ellipsizeMode="tail"'), 'HomeScreen.js: text protected with ellipsizeMode="tail"');
assert(homeScreenJs.includes('flexShrink: 0'), 'HomeScreen.js: icon circles and chevrons protected with flexShrink: 0');
assert(homeScreenJs.includes('minWidth: 0'), 'HomeScreen.js: gridTextWrap has minWidth: 0 to prevent overflow');

const punchScreenPath = path.join(ROOT_DIR, 'mobile', 'src', 'screens', 'PunchScreen.js');
const punchScreenJs = fs.readFileSync(punchScreenPath, 'utf8');
assert(!punchScreenJs.includes("height: 350,"), 'PunchScreen.js: fixed height: 350 on cameraFrame replaced with adaptive height');
assert(punchScreenJs.includes('useResponsiveLayout'), 'PunchScreen.js: integrates useResponsiveLayout hook');

const profileScreenPath = path.join(ROOT_DIR, 'mobile', 'src', 'screens', 'ProfileScreen.js');
const profileScreenJs = fs.readFileSync(profileScreenPath, 'utf8');
assert(profileScreenJs.includes("flexShrink: 1"), 'ProfileScreen.js: detailValue has flexShrink: 1 to prevent text clipping');
assert(profileScreenJs.includes("minWidth: 0"), 'ProfileScreen.js: detailValue has minWidth: 0 to prevent row overflow');

const adminHomePath = path.join(ROOT_DIR, 'mobile', 'src', 'screens', 'admin', 'AdminHomeScreen.js');
const adminHomeJs = fs.readFileSync(adminHomePath, 'utf8');
assert(!adminHomeJs.includes("width: '31%',"), 'AdminHomeScreen.js: fixed width: 31% replaced with dynamic actionCardWidth');
assert(adminHomeJs.includes('useResponsiveLayout'), 'AdminHomeScreen.js: integrates useResponsiveLayout hook');
assert(adminHomeJs.includes('getActionCardColumns'), 'AdminHomeScreen.js: integrates getActionCardColumns');

const featureScreensPath = path.join(ROOT_DIR, 'mobile', 'src', 'screens', 'FeatureScreens.js');
const featureScreensJs = fs.readFileSync(featureScreensPath, 'utf8');
assert(!featureScreensJs.includes("minWidth: '45%'"), 'FeatureScreens.js: rigid minWidth: 45% replaced with fluid basis');

const mobileAppPath = path.join(ROOT_DIR, 'mobile', 'App.js');
const mobileAppJs = fs.readFileSync(mobileAppPath, 'utf8');
assert(!mobileAppJs.includes("height: Platform.OS === 'ios' ? 76 : 54,"), 'App.js: bottomNavContainer height updated from 54dp to prevent Android label clipping');
assert(mobileAppJs.includes('useResponsiveLayout'), 'App.js: integrates useResponsiveLayout');

console.log('\n======================================================================');
console.log(`TOTAL TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED:               ${passedTests}`);
console.log(`FAILED:               ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (totalTests === passedTests) {
  console.log('>>> ALL MULTI-VIEWPORT RESPONSIVE TESTS PASSED SUCCESSFULLY! <<<\n');
} else {
  console.error('>>> SOME RESPONSIVE TESTS FAILED! <<<\n');
  process.exit(1);
}
