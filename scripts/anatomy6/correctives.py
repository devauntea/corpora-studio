"""Build-time contact correctives for bent elbows and knees.

At each key angle the bend is skinned exactly as the app does (DQS + centres of
rotation). Wherever skin of the forearm/shank actually penetrates the upper arm/
thigh (tested against the opposite segment's posed surface, not a plane), both
sides are pushed apart by half the overlap. The push is diffused over the
surrounding skin, so the contact flattens tissue smoothly instead of carving it.
The posed displacement is rotated into each vertex's bind frame and stored per
angle; the app interpolates by joint angle and adds it before skinning.
Visual contact approximation, not tissue mechanics.
"""
from __future__ import annotations

import numpy as np
import scipy.sparse as sp
from scipy.spatial import cKDTree

import relief as R
import rig7

ROOTS = {"elbow": "lowerarm01", "knee": "lowerleg01"}
REGION = 2.2  # dm around the joint pivot


def child_weight(bones, offsets, indices, weights, joint, side):
    moved = rig7.descendants(bones, f"{ROOTS[joint]}.{side}")
    counts = np.diff(offsets)
    vid = np.repeat(np.arange(len(counts)), counts)
    out = np.zeros(len(counts))
    np.add.at(out, vid, weights * moved[indices])
    return out


def contact(p, full, A, rig, cor, muscularity, joint, side, degrees,
            gap=0.004, iterations=8, diffuse=10):
    bones, offsets, indices, weights = rig
    duals, pivot, _ = rig7.joint_bend(bones, muscularity, joint, side, degrees)
    s, rot = rig7.skin_cor(p, offsets, indices, weights, duals, *cor)
    region = np.flatnonzero(np.linalg.norm(s - pivot, axis=1) < REGION)
    cw = child_weight(bones, offsets, indices, weights, joint, side)[region]
    child, parent = cw >= 0.5, cw < 0.5
    tri = full[np.isin(full, region).all(1)]
    remap = -np.ones(len(p), np.int64)
    remap[region] = np.arange(len(region))
    tri = remap[tri]
    # Smoothing operator on the region (uniform Laplacian).
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    m = len(region)
    Adj = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(m, m))
    Adj = ((Adj + Adj.T) > 0).astype(float).tocsr()
    deg = np.maximum(np.asarray(Adj.sum(1)).ravel(), 1)
    base = s[region]
    D = np.zeros((m, 3))
    for _ in range(iterations):
        x = base + D
        nrm = R.normals(x, tri)
        target = np.zeros((m, 3))
        hit = np.zeros(m, bool)
        for a, b in ((child, parent), (parent, child)):
            ia, ib = np.flatnonzero(a), np.flatnonzero(b)
            tree = cKDTree(x[ib])
            dist, k = tree.query(x[ia], distance_upper_bound=0.35)
            ok = np.isfinite(dist)
            ia, j = ia[ok], ib[k[ok]]
            depth = np.einsum("ij,ij->i", x[ia] - x[j], nrm[j])
            # Penetration: inside the opposite surface and facing it.
            pen = (depth < gap) & (np.einsum("ij,ij->i", nrm[ia], nrm[j]) < 0.0)
            ia, j, depth = ia[pen], j[pen], depth[pen]
            target[ia] += nrm[j] * (0.5 * (gap - depth))[:, None]
            hit[ia] = True
        if not hit.any():
            break
        D[hit] += target[hit]
        # Diffuse so neighbours follow; contact points keep at least their push.
        for _ in range(diffuse):
            smoothed = 0.5 * D + 0.5 * (Adj @ D) / deg[:, None]
            keep = hit & (np.linalg.norm(D, axis=1) > np.linalg.norm(smoothed, axis=1))
            smoothed[keep] = D[keep]
            D = smoothed
    # Fade to zero at the region boundary so nothing outside moves.
    r = np.linalg.norm(base - pivot, axis=1)
    fade = np.clip((REGION - r) / 0.5, 0, 1)
    D *= (fade * fade * (3 - 2 * fade))[:, None]
    delta_bind = rig7.rotate_back(rot[region], D)
    return region, delta_bind, s
