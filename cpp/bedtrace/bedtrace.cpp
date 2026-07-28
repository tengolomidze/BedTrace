// bedtrace.cpp
// 
// Run (Inline arguments):
//   ./bedtrace <seed> <xMin> <xMax> <zMin> <zMax> <tile> <worldType> <kernelPath> <patterns...>
// Example:
//   ./bedtrace 1 -10000 10000 -10000 10000 4096 overworld_floor bedtrace.cl 0,-60,0,0 -1,-60,0,1 -2,-60,0,0
// 
// worldTypes -> overworld_floor, nether_floor, nether_roof
//

#define CL_TARGET_OPENCL_VERSION 120
#include <CL/cl.h>
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include "xoroshiro128++.h"
#include "legacy.h"

struct PatternEntry {
    int32_t dx, y, dz, expected;
};

static std::string loadKernelSource(const char* path) {
    std::ifstream f(path);
    if (!f) {
        std::cerr << "Cannot open kernel file: " << path << "\n";
        std::exit(1);
    }
    std::stringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

static void checkCl(cl_int err, const char* what) {
    if (err != CL_SUCCESS) {
        std::cerr << "OpenCL error " << err << " during: " << what << "\n";
        std::exit(1);
    }
}

static bool parsePatternEntry(const std::string& s, PatternEntry& entry) {
    std::stringstream ss(s);
    char c1, c2, c3;
    if (ss >> entry.dx >> c1 >> entry.y >> c2 >> entry.dz >> c3 >> entry.expected)
        if (c1 == ',' && c2 == ',' && c3 == ',')
            return true;
    return false;
}

static std::vector<PatternEntry> loadPatterns(int argc, char** argv, int startIdx) {
    std::vector<PatternEntry> pattern;

    for (int i = startIdx; i < argc; ++i) {
        PatternEntry entry;
        if (!parsePatternEntry(argv[i], entry)) {
            std::cerr << "Invalid pattern argument [" << i << "]: '" << argv[i] << "'\n"
                << "Expected format: dx,y,dz,expected (e.g., 0,-60,0,0)\n";
            std::exit(1);
        }
        pattern.push_back(entry);
    }
    std::cout << "Loaded " << pattern.size() << " pattern entries from command line.\n";
    return pattern;
}

int main0(int argc, char** argv) {
    setvbuf(stdout, nullptr, _IONBF, 0);
    if (argc < 9) {
        std::cerr << "\n\Incorrect Arguments!    Usage: "
            << "bedtrace.exe <seed> <xMin> <xMax> <zMin> <zMax> <tile> <kernel.cl> <patterns...>\n"
            << "Example: ./bedtrace.exe 1 -10000 10000 -10000 10000 4096 bedtrace.cl 0,-60,0,0 -1,-60,0,1 -2,-60,0,0\n";
        return 1;
    }

    int64_t seed = std::stoll(argv[1]);
    int32_t xMin = std::stoi(argv[2]);
    int32_t xMax = std::stoi(argv[3]);
    int32_t zMin = std::stoi(argv[4]);
    int32_t zMax = std::stoi(argv[5]);
    int32_t tile = std::stoi(argv[6]);
    const char* worldType = argv[7];
    const char* kernelPath = argv[8];
    std::vector<PatternEntry> pattern = loadPatterns(argc, argv, 9);
    if (pattern.empty()) {
        std::cerr << "Error: No valid pattern entries loaded.\n";
        return 1;
    }

    int32_t upper, lower, worldTypeId;
    uint64_t rseed0, rseed1;

    if (strcmp(worldType, "nether_floor") == 0) {
        Legacy r(seed, "minecraft:bedrock_floor");
        rseed0 = static_cast<uint64_t>(r.nextLong());
        rseed1 = 0;
        upper = 5;
        lower = 0;
        worldTypeId = 1;
    } else if (strcmp(worldType, "nether_roof") == 0) {
        Legacy r(seed, "minecraft:bedrock_roof");
        rseed0 = static_cast<uint64_t>(r.nextLong());
        rseed1 = 0;
        upper = 127;
        lower = 122;
        worldTypeId = 2;
    } else {
        Xoroshiro xoroshiro(seed, "minecraft:bedrock_floor");
        std::pair<uint64_t, uint64_t> seeds = xoroshiro.state();
        rseed0 = seeds.first;
        rseed1 = seeds.second;
        upper = -59;
        lower = -64;
        worldTypeId = 0;
    }


    cl_uint numPlatforms = 0;
    checkCl(clGetPlatformIDs(0, nullptr, &numPlatforms), "clGetPlatformIDs count");
    std::vector<cl_platform_id> platforms(numPlatforms);
    checkCl(clGetPlatformIDs(numPlatforms, platforms.data(), nullptr), "clGetPlatformIDs");

    cl_device_id device = nullptr;

    for (auto p : platforms) {
        cl_uint numDevices = 0;
        if (clGetDeviceIDs(p, CL_DEVICE_TYPE_GPU, 0, nullptr, &numDevices) == CL_SUCCESS && numDevices > 0) {
            std::vector<cl_device_id> devices(numDevices);
            clGetDeviceIDs(p, CL_DEVICE_TYPE_GPU, numDevices, devices.data(), nullptr);
            device = devices[0];
            break;
        }
    }

    if (!device) {
        std::cout << "No GPU found. Falling back to CPU...\n";
        for (auto p : platforms) {
            cl_uint numDevices = 0;
            if (clGetDeviceIDs(p, CL_DEVICE_TYPE_CPU, 0, nullptr, &numDevices) == CL_SUCCESS && numDevices > 0) {
                std::vector<cl_device_id> devices(numDevices);
                clGetDeviceIDs(p, CL_DEVICE_TYPE_CPU, numDevices, devices.data(), nullptr);
                device = devices[0];
                break;
            }
        }
    }

    if (!device) {
        std::cerr << "Error: No OpenCL GPU or CPU device found.\n";
        return 1;
    }

    char nameBuf[256] = {};
    clGetDeviceInfo(device, CL_DEVICE_NAME, sizeof(nameBuf), nameBuf, nullptr);
    std::cout << "Using device: " << nameBuf << "\n";

    cl_int err;
    cl_context ctx = clCreateContext(nullptr, 1, &device, nullptr, nullptr, &err);
    checkCl(err, "clCreateContext");
    cl_queue_properties properties[] = { 0 };
    cl_command_queue queue = clCreateCommandQueueWithProperties(ctx, device, properties, &err);
    checkCl(err, "clCreateCommandQueueWithProperties");

    std::string src = loadKernelSource(kernelPath);
    const char* srcPtr = src.c_str();
    size_t srcLen = src.size();
    cl_program program = clCreateProgramWithSource(ctx, 1, &srcPtr, &srcLen, &err);
    checkCl(err, "clCreateProgramWithSource");
    err = clBuildProgram(program, 1, &device, "", nullptr, nullptr);
    if (err != CL_SUCCESS) {
        size_t logSize = 0;
        clGetProgramBuildInfo(program, device, CL_PROGRAM_BUILD_LOG, 0, nullptr, &logSize);
        std::vector<char> log(logSize);
        clGetProgramBuildInfo(program, device, CL_PROGRAM_BUILD_LOG, logSize, log.data(), nullptr);
        std::cerr << "Build error:\n" << log.data() << "\n";
        return 1;
    }
    cl_kernel kernel = clCreateKernel(program, "search_pattern", &err);
    checkCl(err, "clCreateKernel");

    cl_mem patternBuf = clCreateBuffer(ctx, CL_MEM_READ_ONLY | CL_MEM_COPY_HOST_PTR,
        pattern.size() * sizeof(PatternEntry), pattern.data(), &err);
    checkCl(err, "clCreateBuffer pattern");

    const int maxHits = 1 << 16;
    cl_mem hitsBuf = clCreateBuffer(ctx, CL_MEM_WRITE_ONLY, maxHits * sizeof(cl_int2), nullptr, &err);
    checkCl(err, "clCreateBuffer hits");
    cl_mem countBuf = clCreateBuffer(ctx, CL_MEM_READ_WRITE, sizeof(cl_int), nullptr, &err);
    checkCl(err, "clCreateBuffer count");

    cl_ulong clRseed0 = rseed0, clRseed1 = rseed1;
    int patternCount = (int)pattern.size();

    long long totalArea = (long long)(xMax - xMin) * (long long)(zMax - zMin);
    long long totalChecked = 0;
    std::cout << "Searching " << totalArea << " candidate origins...\n";

    for (int32_t xBase = xMin; xBase < xMax; xBase += tile) {
        int tw = std::min(tile, xMax - xBase);
        for (int32_t zBase = zMin; zBase < zMax; zBase += tile) {
            int th = std::min(tile, zMax - zBase);

            cl_int zero = 0;
            checkCl(clEnqueueWriteBuffer(queue, countBuf, CL_TRUE, 0, sizeof(cl_int), &zero, 0, nullptr, nullptr),
                "reset countBuf");

            int argi = 0;
            clSetKernelArg(kernel, argi++, sizeof(cl_ulong), &clRseed0);
            clSetKernelArg(kernel, argi++, sizeof(cl_ulong), &clRseed1);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &lower);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &upper);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &worldTypeId);
            clSetKernelArg(kernel, argi++, sizeof(cl_mem), &patternBuf);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &patternCount);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &xBase);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &zBase);
            clSetKernelArg(kernel, argi++, sizeof(cl_mem), &hitsBuf);
            clSetKernelArg(kernel, argi++, sizeof(cl_mem), &countBuf);
            clSetKernelArg(kernel, argi++, sizeof(cl_int), &maxHits);

            size_t globalSize[2] = { (size_t)tw, (size_t)th };
            checkCl(clEnqueueNDRangeKernel(queue, kernel, 2, nullptr, globalSize, nullptr, 0, nullptr, nullptr),
                "enqueue kernel");
            clFinish(queue);

            cl_int hitCount = 0;
            clEnqueueReadBuffer(queue, countBuf, CL_TRUE, 0, sizeof(cl_int), &hitCount, 0, nullptr, nullptr);
            if (hitCount > 0) {
                int toRead = std::min((int)hitCount, maxHits);
                std::vector<cl_int2> hits(toRead);
                checkCl(clEnqueueReadBuffer(queue, hitsBuf, CL_TRUE, 0, toRead * sizeof(cl_int2), hits.data(), 0, nullptr, nullptr), "read hitsBuf");
                for (auto& h : hits)
                    std::cout << "match: " << h.s[0] << " " << h.s[1] << std::endl;
            }
            totalChecked += (long long)tw * th;
        }
        std::cout << "progress: " << totalChecked << "/" << totalArea << std::endl;
    }

    clReleaseMemObject(patternBuf);
    clReleaseMemObject(hitsBuf);
    clReleaseMemObject(countBuf);
    clReleaseKernel(kernel);
    clReleaseProgram(program);
    clReleaseCommandQueue(queue);
    clReleaseContext(ctx);
    return 0;
}