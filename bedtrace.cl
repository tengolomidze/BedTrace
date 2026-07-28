// bedrock_search.cl

#pragma OPENCL EXTENSION cl_khr_fp64 : enable

typedef struct __attribute__((packed)) {
    int dx;
    int y;     
    int dz;
    int expected; 
} PatternEntry;

inline ulong rotl64(ulong x, int k) {
    return (x << k) | (x >> (64 - k));
}

inline ulong xoro_next(ulong2* s) {
    const ulong s0 = (*s).x;
    ulong s1 = (*s).y;
    const ulong result = rotl64(s0 + s1, 17) + s0;

    s1 ^= s0;
    (*s).x = rotl64(s0, 49) ^ s1 ^ (s1 << 21);
    (*s).y = rotl64(s1, 28);

    return result;
}

inline float xoro_next_float(ulong2* s) {
    return (float)(xoro_next(s) >> 40) * 5.9604645e-8f;
}


inline int legacy_next(ulong s, int bits) {
    s = (s * 0x5DEECE66DUL + 0xBUL) & ((1UL << 48) - 1);
    return (int)(s >> (48 - bits));
}

inline float legacy_next_float(ulong s) {
    return (float)legacy_next(s, 24) / (float)(1 << 24);
}

inline ulong2 xoro_from_raw(ulong s0, ulong s1) {
    ulong2 r;
    if (s0 == 0UL && s1 == 0UL) {
        r.x = 0x9e3779b97f4a7c15UL;
        r.y = 0x6a09e667f3bcc909UL;
    } else {
        r.x = s0;
        r.y = s1;
    }
    return r;
}

inline ulong legacy_from_raw(ulong s) {
    return (s ^ 0x5DEECE66DUL) & ((1UL << 48) - 1);
}

inline int bedrock_at_overworld_floor(ulong rseed0, ulong rseed1, int x, int y, int z, int lower, int upper) {
    if (y <= lower) return 0;
    if (y >= upper) return 1;

    double f = 1.0 - (double)(y - lower) / (double)(upper - lower);

    long seed = (long)(int)(x * 3129871)
              ^ ((long)z * 116129781L)
              ^ (long)y;
    seed = seed * seed * 42317861L + seed * 11L;
    seed >>= 16;

    ulong2 s = xoro_from_raw((ulong)seed ^ rseed0, rseed1);
    float r = xoro_next_float(&s);
    return (r < f) ? 0 : 1;
}

inline int bedrock_at_nether_floor(ulong rseed, int x, int y, int z, int lower, int upper) {
    if (y <= lower) return 0;
    if (y >= upper) return 1;

    double f = 1.0 - (double)(y - lower) / (double)(upper - lower);

    long seed = (long)(int)(x * 3129871)
              ^ ((long)z * 116129781L)
              ^ (long)y;
    seed = seed * seed * 42317861L + seed * 11L;
    seed >>= 16;

    ulong s = legacy_from_raw((ulong)seed ^ rseed);
    float r = legacy_next_float(s);
    return (r < f) ? 0 : 1;
}

inline int bedrock_at_nether_roof(ulong rseed, int x, int y, int z, int lower, int upper) {
    if (y <= lower) return 1;
    if (y >= upper) return 0;

    double f = 1.0 - (double)(y - lower) / (double)(upper - lower);

    long seed = (long)(int)(x * 3129871)
              ^ ((long)z * 116129781L)
              ^ (long)y;
    seed = seed * seed * 42317861L + seed * 11L;
    seed >>= 16;

    ulong s = legacy_from_raw((ulong)seed ^ rseed);
    float r = legacy_next_float(s);
    return (r < f) ? 1 : 0;
}

__kernel void search_pattern(
    ulong rseed0,
    ulong rseed1,
    int lower,
    int upper,
    int worldTypeId,
    __global const PatternEntry* pattern,
    int patternCount,
    int xBase,
    int zBase,
    __global int2* outHits,
    __global volatile int* outCount,
    int maxHits
)
{
    int gx = get_global_id(0);
    int gz = get_global_id(1);
    int X0 = xBase + gx;
    int Z0 = zBase + gz;


    for (int i = 0; i < patternCount; i++) {
        PatternEntry e = pattern[i];
        int actual;
        if (worldTypeId == 0){
            actual = bedrock_at_overworld_floor(rseed0, rseed1, X0 + e.dx, e.y, Z0 + e.dz, lower, upper);
        } else if (worldTypeId == 1) {
            actual = bedrock_at_nether_floor(rseed0, X0 + e.dx, e.y, Z0 + e.dz, lower, upper);
        } else {
            actual = bedrock_at_nether_roof(rseed0, X0 + e.dx, e.y, Z0 + e.dz, lower, upper);
        }
        
        if (actual != e.expected) {
            return;
        }
    }

    int idx = atomic_inc(outCount);
    if (idx < maxHits) {
        outHits[idx] = (int2)(X0, Z0);
    }
}
