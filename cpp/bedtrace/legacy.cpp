#include <cstdint>
#include <stdexcept>
#include <vector>
#include "legacy.h"

int32_t javaHashcode(const std::string& s) {
    uint32_t hash = 0;
    for (char c : s)
        hash = 31 * hash + static_cast<uint32_t>(static_cast<unsigned char>(c));
    return static_cast<int32_t>(hash);
}

Legacy::Legacy(int64_t seed) {
    setSeed(seed);
}

Legacy::Legacy(int64_t seed, const std::string& str) {
    setSeed(seed);
    setSeed(nextLong() ^ javaHashcode(str));
}

void Legacy::setSeed(int64_t seed) {
    m_seed = (static_cast<uint64_t>(seed) ^ MULTIPLIER) & MASK;
    m_haveNextNextGaussian = false;
}

int32_t Legacy::next(int bits) {
    uint64_t oldseed = m_seed;
    uint64_t nextseed = (oldseed * MULTIPLIER + ADDEND) & MASK;
    m_seed = nextseed;
    return static_cast<int32_t>(nextseed >> (48 - bits));
}

int32_t Legacy::nextInt() {
    return next(32);
}

int32_t Legacy::nextInt(int32_t bound) {
    if (bound <= 0)
        throw std::invalid_argument("bound must be positive");

    if ((bound & -bound) == bound) {
        return static_cast<int32_t>((static_cast<int64_t>(bound) * next(31)) >> 31);
    }

    int32_t bits, val;
    do {
        bits = next(31);
        val = bits % bound;
    } while (bits - val + (bound - 1) < 0);
    return val;
}

int64_t Legacy::nextLong() {
    int64_t top = next(32);
    int64_t bottom = next(32);
    return (top << 32) + bottom;
}

float Legacy::nextFloat() {
    return next(24) / (static_cast<float>(1 << 24));
}

double Legacy::nextDouble() {
    int64_t high = static_cast<int64_t>(next(26)) << 27;
    int64_t low = next(27);
    int64_t val = high + low;
    return val * DOUBLE_UNIT;
}

bool Legacy::nextBoolean() {
    return next(1) != 0;
}

void Legacy::nextBytes(std::vector<uint8_t>& bytes) {
    for (size_t i = 0; i < bytes.size();) {
        int32_t rnd = nextInt();
        for (int n = std::min(bytes.size() - i, size_t(4)); n > 0; --n) {
            bytes[i++] = static_cast<uint8_t>(rnd);
            rnd >>= 8;
        }
    }
}

Legacy* Legacy::at(int32_t x, int32_t y, int32_t z) {
    int64_t seed = (int64_t)(int32_t)(x * 3129871)
        ^ ((int64_t)z * 116129781LL) 
        ^ (int64_t)y;
    seed = seed * seed * 42317861LL + seed * 0xbLL;
    seed >>= 16;
    return new Legacy((uint64_t)seed ^ m_seed);
}