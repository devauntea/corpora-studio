"""Build-time deformation tools: linear blend skinning and ARAP pose solves.

ARAP (Sorkine & Alexa 2007) is used offline to author pose correctives: a
target pose is solved with rigid handles far from the joint and free joint
tissue, then stored as a rest-space corrective relative to linear blend
skinning. Nothing here runs in the application.
"""
from __future__ import annotations

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla


def axis_angle(axis: np.ndarray, angle: float) -> np.ndarray:
    a = axis / np.linalg.norm(axis)
    c, s = np.cos(angle), np.sin(angle)
    x, y, z = a
    return np.array([
        [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
        [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
        [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)],
    ])


def rigid(pivot: np.ndarray, rotation: np.ndarray) -> np.ndarray:
    """4x4 rotation about a pivot point."""
    m = np.eye(4)
    m[:3, :3] = rotation
    m[:3, 3] = pivot - rotation @ pivot
    return m


def apply(m: np.ndarray, p: np.ndarray) -> np.ndarray:
    return p @ m[:3, :3].T + m[:3, 3]


def lbs(v: np.ndarray, weights: np.ndarray, transforms: list[np.ndarray]) -> np.ndarray:
    """weights (n, k) rows sum to 1 where skinned; transforms k 4x4 world matrices."""
    out = np.zeros_like(v)
    covered = weights.sum(axis=1)
    for k, m in enumerate(transforms):
        w = weights[:, k]
        if not w.any():
            continue
        out += w[:, None] * apply(m, v)
    return out + (1 - covered)[:, None] * v


def edges_of(faces) -> np.ndarray:
    e = set()
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]):
            e.add((min(a, b), max(a, b)))
    return np.array(sorted(e), dtype=np.int64)


def cotan_weights(v: np.ndarray, tris: np.ndarray) -> sp.csr_matrix:
    """Symmetric cotangent weight matrix (clamped positive for robustness)."""
    n = len(v)
    rows, cols, vals = [], [], []
    for k in range(3):
        i, j, o = tris[:, k], tris[:, (k + 1) % 3], tris[:, (k + 2) % 3]
        u, w = v[i] - v[o], v[j] - v[o]
        cot = (u * w).sum(1) / np.maximum(np.linalg.norm(np.cross(u, w), axis=1), 1e-12)
        rows += [i, j]
        cols += [j, i]
        vals += [0.5 * cot, 0.5 * cot]
    W = sp.coo_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n)).tocsr()
    W.data = np.clip(W.data, 1e-4, None)
    return W


class Arap:
    """ARAP solver on a fixed mesh with a fixed set of constrained vertices."""

    def __init__(self, v: np.ndarray, tris: np.ndarray, fixed: np.ndarray):
        self.v = v
        self.n = len(v)
        self.W = cotan_weights(v, tris).tocoo()
        self.i, self.j, self.w = self.W.row, self.W.col, self.W.data
        L = sp.diags(np.asarray(self.W.sum(axis=1)).ravel()) - self.W.tocsr()
        self.fixed = np.asarray(fixed, dtype=bool)
        self.free = np.flatnonzero(~self.fixed)
        self.fix = np.flatnonzero(self.fixed)
        Lc = L.tocsc()
        self.Lff = Lc[self.free][:, self.free]
        self.Lfc = Lc[self.free][:, self.fix]
        self.solve_ff = spla.factorized(self.Lff.tocsc())
        self.e0 = v[self.i] - v[self.j]

    def solve(self, guess: np.ndarray, iterations: int = 12) -> np.ndarray:
        p = guess.copy()
        for _ in range(iterations):
            e1 = p[self.i] - p[self.j]
            S = np.zeros((self.n, 3, 3))
            np.add.at(S, self.i, self.w[:, None, None] * e0_outer(self.e0, e1))
            U, _, Vt = np.linalg.svd(S)
            R = np.einsum("nij,njk->nik", Vt.transpose(0, 2, 1), U.transpose(0, 2, 1))
            bad = np.linalg.det(R) < 0
            if bad.any():
                U[bad, :, 2] *= -1
                R[bad] = np.einsum("nij,njk->nik", Vt[bad].transpose(0, 2, 1), U[bad].transpose(0, 2, 1))
            rhs_e = 0.5 * self.w[:, None] * np.einsum("nij,nj->ni", R[self.i] + R[self.j], self.e0)
            b = np.zeros((self.n, 3))
            np.add.at(b, self.i, rhs_e)
            bf = b[self.free] - self.Lfc @ p[self.fix]
            for c in range(3):
                p[self.free, c] = self.solve_ff(bf[:, c])
        return p


def e0_outer(e0: np.ndarray, e1: np.ndarray) -> np.ndarray:
    return np.einsum("ni,nj->nij", e0, e1)
