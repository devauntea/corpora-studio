"""Python mirror of src/skeleton.ts for build-time pose corrective authoring.

Reproduces the application's joint frames, elbow/knee rotations and
normalized dual-quaternion skinning (Kavan et al. 2007) for single-joint
bends, so correctives authored here are expressed in the same bind space.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ANATOMY = Path(__file__).resolve().parents[2] / "public/anatomy"


def load_rig(sex: str, n: int):
    meta = json.loads((ANATOMY / f"rig-v6-{sex}.json").read_text())
    raw = (ANATOMY / meta["buffer"]).read_bytes()
    offsets = np.frombuffer(raw, "<u4", count=n + 1).astype(np.int64)
    indices = np.frombuffer(raw, np.uint8, count=meta["influenceCount"], offset=(n + 1) * 4).astype(np.int64)
    weights = np.frombuffer(raw, "<f4", count=meta["influenceCount"], offset=meta["weightsOffset"]).astype(np.float64)
    return meta["bones"], offsets, indices, weights


def frames(bones, muscularity: float):
    out = []
    for b in bones:
        h = np.array(b["average"]["head"]) + (np.array(b["fit"]["head"]) - np.array(b["average"]["head"])) * muscularity
        t = np.array(b["average"]["tail"]) + (np.array(b["fit"]["tail"]) - np.array(b["average"]["tail"])) * muscularity
        out.append((h, t))
    return out


def descendants(bones, root: str) -> np.ndarray:
    names = [b["name"] for b in bones]
    r = names.index(root)
    out = np.zeros(len(bones), bool)
    for i in range(len(bones)):
        j = i
        while j >= 0:
            if j == r:
                out[i] = True
                break
            j = bones[j]["parent"]
    return out


def quat(axis, degrees):
    a = np.asarray(axis, float)
    a = a / np.linalg.norm(a)
    h = np.radians(degrees) / 2
    return np.array([*(a * np.sin(h)), np.cos(h)])  # x, y, z, w


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz])


def qrot(q, p):
    x, y, z, w = q
    t = 2 * np.cross(np.array([x, y, z]), p)
    return p + w * t + np.cross(np.array([x, y, z]), t)


def joint_bend(bones, muscularity, joint: str, side: str, degrees: float):
    """Dual quaternions per bone for one elbow or knee bend, as in skeleton.ts."""
    fr = frames(bones, muscularity)
    names = [b["name"] for b in bones]
    if joint == "knee":
        bone = f"lowerleg01.{side}"
        axis = np.array([1.0, 0, 0])
    else:
        bone = f"lowerarm01.{side}"
        upper = fr[names.index(f"upperarm01.{side}")][0]
        elbow = fr[names.index(bone)][0]
        arm = (elbow - upper) / np.linalg.norm(elbow - upper)
        axis = np.array([arm[1], -arm[0], 0.0])
    q = quat(axis, degrees)
    pivot = fr[names.index(bone)][0]
    t = pivot - qrot(q, pivot)
    moved = descendants(bones, bone)
    duals = np.zeros((len(bones), 8))
    duals[:, 3] = 1
    d = 0.5 * qmul(np.array([*t, 0.0]), q)
    duals[moved, :4] = q
    duals[moved, 4:] = d
    return duals, pivot, axis


def skin(p: np.ndarray, offsets, indices, weights, duals):
    """Vectorized normalized DQS; returns skinned points and per-vertex blended rotation quats."""
    n = len(p)
    counts = np.diff(offsets)
    vid = np.repeat(np.arange(n), counts)
    dq = duals[indices] * weights[:, None]
    ref = duals[indices[offsets[:-1]]][:, :4]
    sign = np.where((duals[indices][:, :4] * ref[vid]).sum(1) < 0, -1.0, 1.0)
    dq *= sign[:, None]
    acc = np.zeros((n, 8))
    np.add.at(acc, vid, dq)
    norm = np.linalg.norm(acc[:, :4], axis=1, keepdims=True)
    acc /= norm
    r, d = acc[:, :4], acc[:, 4:]
    xyz, w = r[:, :3], r[:, 3:4]
    t = 2 * np.cross(xyz, p)
    rotated = p + w * t + np.cross(xyz, t)
    # translation = 2 * (d * conj(r)).xyz
    dx, dy, dz, dw = d.T
    x, y, z, ww = r.T
    trans = 2 * np.stack([
        -dw * x + dx * ww - dy * z + dz * y,
        -dw * y + dx * z + dy * ww - dz * x,
        -dw * z - dx * y + dy * x + dz * ww,
    ], axis=1)
    return rotated + trans, r


def rotate_back(r: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Apply the inverse of per-vertex rotation quaternions r to vectors v."""
    inv = r.copy()
    inv[:, :3] *= -1
    xyz, w = inv[:, :3], inv[:, 3:4]
    t = 2 * np.cross(xyz, v)
    return v + w * t + np.cross(xyz, t)


JOINT_ROOTS = {"elbow": "lowerarm01", "knee": "lowerleg01"}


def centers_of_rotation(p, bones, offsets, indices, weights, bins=48, band=(0.002, 0.998), max_radius=1.1):
    """Per-vertex centre of rotation for elbow/knee transition vertices.

    Approximates Le & Hodgins (2016) optimized centres of rotation: a vertex's
    CoR is the centroid of the skin ring whose child-chain weight matches its
    own (vertices with similar weight vectors), restricted to the same joint.
    Returns (vertex indices, CoR positions).
    """
    n = len(p)
    counts = np.diff(offsets)
    vid = np.repeat(np.arange(n), counts)
    out_idx, out_cor, out_alpha = [], [], []
    for joint, root in JOINT_ROOTS.items():
        for side in "LR":
            moved = descendants(bones, f"{root}.{side}")
            parent = bones[[b["name"] for b in bones].index(f"{root}.{side}")]["parent"]
            limb = moved | descendants(bones, bones[parent]["name"])
            w = np.zeros(n)
            np.add.at(w, vid, weights * moved[indices])
            on_limb = np.zeros(n)
            np.add.at(on_limb, vid, weights * limb[indices])
            sel = (w > band[0]) & (w < band[1])
            if sel.sum() > 50:
                # Drop stray influences before averaging: keep the main cluster around the median.
                centre0 = np.median(p[sel], axis=0)
                sel &= np.linalg.norm(p - centre0, axis=1) < 2.2
            if not sel.any():
                continue
            k = np.minimum((w[sel] * bins).astype(int), bins - 1)
            sums = np.zeros((bins, 3))
            cnt = np.zeros(bins)
            np.add.at(sums, k, p[sel])
            np.add.at(cnt, k, 1)
            ok = cnt > 0
            centres = np.zeros((bins, 3))
            centres[ok] = sums[ok] / cnt[ok, None]
            # Fill empty bins and smooth along the weight axis.
            x = np.flatnonzero(ok)
            for c in range(3):
                centres[:, c] = np.interp(np.arange(bins), x, centres[x, c])
            kernel = np.array([1, 2, 3, 2, 1], float)
            kernel /= kernel.sum()
            pad = np.pad(centres, ((2, 2), (0, 0)), mode="edge")
            centres = np.stack([np.convolve(pad[:, c], kernel, "valid") for c in range(3)], 1)
            # Interpolate between bin centres.
            f = np.clip(w[sel] * bins - 0.5, 0, bins - 1)
            lo = np.floor(f).astype(int)
            hi = np.minimum(lo + 1, bins - 1)
            t = (f - lo)[:, None]
            cor = centres[lo] * (1 - t) + centres[hi] * t
            # Only vertices lying on their own skin ring: stray far-away influences keep DQS.
            near = np.linalg.norm(p[sel] - cor, axis=1) < max_radius
            out_idx.append(np.flatnonzero(sel)[near])
            out_cor.append(cor[near])
            ws = w[sel][near]
            ramp = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
            out_alpha.append(ramp(band[0], 0.08, ws) * ramp(band[1], 0.92, ws))
    return np.concatenate(out_idx), np.concatenate(out_cor), np.concatenate(out_alpha)


def skin_cor(p, offsets, indices, weights, duals, cor_idx, cor, alpha=None):
    """DQS everywhere, except CoR skinning on transition vertices:
    v' = q (v - c) q* + LBS(c), with q the normalized blended rotation."""
    s, r = skin(p, offsets, indices, weights, duals)
    if len(cor_idx) == 0:
        return s, r
    # Rigid transform of each bone as (rotation quat, translation).
    q = duals[:, :4]
    d = duals[:, 4:]
    x, y, z, w = q.T
    dx, dy, dz, dw = d.T
    trans = 2 * np.stack([-dw * x + dx * w - dy * z + dz * y,
                          -dw * y + dx * z + dy * w - dz * x,
                          -dw * z - dx * y + dy * x + dz * w], 1)
    sel_mask = np.zeros(len(p), bool)
    sel_mask[cor_idx] = True
    counts = np.diff(offsets)
    vid = np.repeat(np.arange(len(p)), counts)
    cor_full = np.zeros_like(p)
    cor_full[cor_idx] = cor
    keep = sel_mask[vid]
    v_i, b_i, w_i = vid[keep], indices[keep], weights[keep]
    c = cor_full[v_i]
    qb = q[b_i]
    t = 2 * np.cross(qb[:, :3], c)
    moved_c = c + qb[:, 3:4] * t + np.cross(qb[:, :3], t) + trans[b_i]
    lbs_c = np.zeros_like(p)
    np.add.at(lbs_c, v_i, w_i[:, None] * moved_c)
    rr = r[cor_idx]
    rel = p[cor_idx] - cor
    t = 2 * np.cross(rr[:, :3], rel)
    corr = rel + rr[:, 3:4] * t + np.cross(rr[:, :3], t) + lbs_c[cor_idx]
    a = np.ones(len(cor_idx)) if alpha is None else alpha
    s[cor_idx] += (corr - s[cor_idx]) * a[:, None]
    return s, r


def contact_crease(s, child_w, pivot, upper_dir, lower_dir, radius, gap=0.01, soft=0.03):
    """Bisector-plane contact for a hinge bend (posed space).

    Flexor-side skin of each segment may not cross the plane bisecting the
    joint angle; a softplus clamp keeps it `gap` short of the plane, so the two
    sides meet in a crease instead of interpenetrating. Extensor-side skin is
    untouched (it legitimately wraps across the plane).
    """
    n = lower_dir - upper_dir
    n /= np.linalg.norm(n)
    inside = upper_dir + lower_dir
    if np.linalg.norm(inside) < 1e-6:
        return s
    inside /= np.linalg.norm(inside)
    rel = s - pivot
    dist = np.linalg.norm(rel, axis=1)
    fade = np.clip((radius * 1.6 - dist) / (radius * 0.6), 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    flexor = np.clip((rel @ inside) / 0.15, 0, 1) * fade
    side = np.where(child_w >= 0.5, 1.0, -1.0)  # +1 child (lower) segment, -1 parent
    d = side * (rel @ n)  # distance into own half-space
    d_new = gap + soft * np.logaddexp(0, (d - gap) / soft)
    certainty = np.minimum(1, np.abs(child_w - 0.5) / 0.25)
    move = (d_new - d) * flexor * certainty
    return s + (side * move)[:, None] * n
