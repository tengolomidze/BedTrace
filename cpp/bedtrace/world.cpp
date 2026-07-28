#include <cstdint>
#include <iostream>
#include "world.h"
#include "legacy.h"

double inline normalize(double x, double a, double b) {
    return (x - a) / (b - a);
}

//World::World(int64_t seed, int32_t l, int32_t u, std::string worldType)
//{
//    Xoroshiro r(seed, worldType);
//    auto [s0, s1] = r.state();
//    rseed0 = s0;
//    rseed1 = s1;
//
//    lower = l;
//    upper = u;
//}

World::World(int64_t seed, int32_t l, int32_t u, std::string worldType)
{
    Legacy r(seed, worldType);
    rseed0 = static_cast<uint64_t>(r.nextLong());

    lower = l;
    upper = u;
}

World::~World()
{}

//int World::at(int32_t x, int32_t y, int32_t z)
//{
//    if (y <= lower) return 0;
//    if (y >= upper) return 1;
//
//    double f = 1.0 - normalize(y, lower, upper);
//    
//    int64_t seed = (int64_t)(int32_t)(x * 3129871)
//        ^ ((int64_t)z * 116129781LL)
//        ^ (int64_t)y;
//    seed = seed * seed * 42317861LL + seed * 0xbLL;
//    seed >>= 16;
//
//    Xoroshiro r((uint64_t)seed ^ rseed0, rseed1);
//    return (r.nextFloat() < f) ? 0 : 1;
//}

int World::at(int32_t x, int32_t y, int32_t z)
{
    if (y <= lower) return 0;
    if (y >= upper) return 1;

    double f = 1.0 - normalize(y, lower, upper);
    
    int64_t seed = (int64_t)(int32_t)(x * 3129871)
        ^ ((int64_t)z * 116129781LL)
        ^ (int64_t)y;
    seed = seed * seed * 42317861LL + seed * 11LL;
    seed >>= 16;

    Legacy r(seed ^ rseed0);
    return (r.nextFloat() < f) ? 0 : 1;
}