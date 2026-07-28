#include <cstdint>
#include <utility>
#include <string>
#include "md5.h"
#include "xoroshiro128++.h"

static inline uint64_t rotl(const uint64_t x, int k) {
    return (x << k) | (x >> (64 - k));
}

static inline uint64_t readInt64BigEndian(const unsigned char* bytes, size_t offset) {
    uint64_t result = 0;
    for (size_t i = 0; i < 8; ++i)
        result = (result << 8) | bytes[offset + i];
    return result;
}

Xoroshiro::Xoroshiro(uint64_t s0, uint64_t s1) {
    s[0] = s0;
    s[1] = s1;
}

Xoroshiro::Xoroshiro(int64_t seed, const std::string& str) {
    std::pair<uint64_t, uint64_t> seeds = seed128(seed);
    uint64_t seed0 = seeds.first;
    uint64_t seed1 = seeds.second;

    if (seed0 == 0 && seed1 == 0)
        s[0] = xmagic1, s[1] = xmagic0;
    else
        s[0] = seed0, s[1] = seed1;

    MD5 md5_hash(str);
    const unsigned char* hash = md5_hash.getDigest();

    uint64_t hseed0 = readInt64BigEndian(hash, 0) ^ next();
    uint64_t hseed1 = readInt64BigEndian(hash, 8) ^ next();

    if (hseed0 == 0 && hseed1 == 0)
        s[0] = xmagic1, s[1] = xmagic0;
    else
        s[0] = hseed0, s[1] = hseed1;

    uint64_t pos_seed0 = next();
    uint64_t pos_seed1 = next();

    s[0] = pos_seed0;
    s[1] = pos_seed1;
}

Xoroshiro* Xoroshiro::at(int32_t x, int32_t y, int32_t z) {
    int64_t seed = (int64_t)(int32_t)(x * 3129871)   // 32-bit wrap, then sign-extend
        ^ ((int64_t)z * 116129781LL)                 // 64-bit multiply
        ^ (int64_t)y;
    seed = seed * seed * 42317861LL + seed * 0xbLL;
    seed >>= 16;
    return new Xoroshiro((uint64_t)seed ^ s[0], s[1]);
}

std::pair<uint64_t, uint64_t> Xoroshiro::seed128(int64_t seed) {
    const uint64_t lo = static_cast<uint64_t>(seed) ^ xmagic0;
    const uint64_t hi = lo + xmagic1;
    return std::make_pair(mix(lo), mix(hi));
}

uint64_t Xoroshiro::mix(uint64_t v) {
    uint64_t x = v;
    x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
    x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
    return x ^ (x >> 31);
}

uint64_t Xoroshiro::next() {
    const uint64_t s0 = s[0];
    uint64_t s1 = s[1];
    const uint64_t result = rotl(s0 + s1, 17) + s0;

    s1 ^= s0;
    s[0] = rotl(s0, 49) ^ s1 ^ (s1 << 21); // a, b
    s[1] = rotl(s1, 28);                  // c

    return result;
}

float Xoroshiro::nextFloat() {
    return static_cast<float>(next() >> 40) * FLOAT_UNIT;
}