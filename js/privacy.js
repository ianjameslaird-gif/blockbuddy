(function (root) {
  "use strict";

  // Flags unit-number patterns such as #12-345. Dollar ranges like S$10-20 are left alone.
  function containsUnitNumber(text) {
    const source = String(text || "").replace(/[–—]/g, "-");
    if (/#\s*\d{1,4}\s*-\s*\d{2,5}/.test(source)) return true;
    if (/\b(?:unit|apt|apartment)\s*#?\s*\d{1,4}(?:\s*-\s*\d{2,5})?\b/i.test(source)) return true;
    if (/\b(?:blk|block)\s*\d{1,4}\s*#\s*\d{1,4}\s*-\s*\d{2,5}\b/i.test(source)) return true;
    if (/(^|[^$\d])\d{1,2}\s*-\s*\d{3,4}(?!\d)/.test(source)) return true;
    return false;
  }

  root.BBPrivacy = { containsUnitNumber: containsUnitNumber };
})(typeof globalThis !== "undefined" ? globalThis : this);
