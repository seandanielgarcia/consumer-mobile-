#!/usr/bin/env bash
# Copy and design-rule linter for the app. Exits 1 on any hit.
#   bash scripts/check-copy.sh            # checks app/ and src/
#   bash scripts/check-copy.sh <paths…>   # checks only those files or folders
#
# Rules:
#   1. No user-facing "garage": JSX text and string/template literals. Identifiers (garageId, garages., api.garages,
#      by_garage, Id<"garages">, ${garage.x} interpolations), import paths, route paths, URL schemes and storage keys
#      are ignored.
#   2. No "Written by AI" copy.
#   3. No hex colours outside src/theme.ts (use colors.* tokens).
set -uo pipefail
cd "$(dirname "$0")/.."
targets=("$@"); [ ${#targets[@]} -eq 0 ] && targets=(app src)
files=$(find "${targets[@]}" -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | sort)
[ -z "$files" ] && { echo "check-copy: no files"; exit 0; }
status=0

# 1. user-facing "garage"
rule1=$(echo "$files" | xargs perl -ne '
  next if /^\s*import\b|require\(/;
  my $t = $_; $t =~ s/\$\{[^}]*\}//g;                       # drop interpolations like ${garage.neighborhood}
  my @hits = ($t =~ /("[^"]*"|'"'"'[^'"'"']*'"'"'|`[^`]*`|>[^<{]*<)/g);
  for my $h (@hits) {
    next unless $h =~ /garage/i;
    next if $h =~ /^"garages"$|^'"'"'garages'"'"'$|by_garage|garageId|api\.garages|garages\.|\/garage|garage-sale\/|garagesale:/;
    next if $h =~ /garage\??\s*:|Doc<|Id</;                 # type annotations and prop keys, not copy
    print "$ARGV:$.:$_"; last;
  }
  close ARGV if eof;' 2>/dev/null)
[ -n "$rule1" ] && { printf '\nRule 1: user-facing "garage" (should be "yard"):\n%s\n' "$rule1"; status=1; }

# 2. "Written by AI"
rule2=$(echo "$files" | xargs grep -n "Written by AI" 2>/dev/null)
[ -n "$rule2" ] && { printf '\nRule 2: "Written by AI" copy:\n%s\n' "$rule2"; status=1; }

# 3. hex colours outside the theme
rule3=$(echo "$files" | grep -v '^src/theme.ts$' | xargs grep -nE '#[0-9A-Fa-f]{3,8}\b' 2>/dev/null)
[ -n "$rule3" ] && { printf '\nRule 3: hex colour outside src/theme.ts (use colors.*):\n%s\n' "$rule3"; status=1; }

[ $status -eq 0 ] && echo "check-copy: ok ($(echo "$files" | wc -l | tr -d ' ') files)"
exit $status
