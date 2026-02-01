/**
 * serializers.hpp - Output serialization utilities for C++ solutions
 * 
 * This file provides helper functions for serializing various data types
 * to stdout in the format expected by the test harness.
 * 
 * These functions are used by the generated harness to output results
 * in a standard format that can be parsed by the backend.
 */

#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>

// Forward declarations for TreeNode and ListNode (defined in structures.hpp)
struct TreeNode;
struct ListNode;

/**
 * Serialize a primitive value (int, long, double, bool)
 * 
 * @param value The primitive value to serialize
 * @return JSON-formatted string representation
 */
template<typename T>
std::string serializePrimitive(T value) {
    return std::to_string(value);
}

// Specialization for bool
template<>
inline std::string serializePrimitive<bool>(bool value) {
    return value ? "true" : "false";
}

// Specialization for double/float with precision
template<>
inline std::string serializePrimitive<double>(double value) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(5) << value;
    std::string result = oss.str();
    // Trim trailing zeros
    while (result.length() > 0 && result.back() == '0') {
        result.pop_back();
    }
    if (result.length() > 0 && result.back() == '.') {
        result.push_back('0');
    }
    return result;
}

/**
 * Serialize a string with proper JSON escaping
 * 
 * @param str The string to serialize
 * @return JSON-formatted string with quotes and escaping
 */
inline std::string serializeString(const std::string& str) {
    std::ostringstream oss;
    oss << '"';
    for (char c : str) {
        switch (c) {
            case '"': oss << "\\\""; break;
            case '\\': oss << "\\\\"; break;
            case '\b': oss << "\\b"; break;
            case '\f': oss << "\\f"; break;
            case '\n': oss << "\\n"; break;
            case '\r': oss << "\\r"; break;
            case '\t': oss << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    oss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    oss << c;
                }
        }
    }
    oss << '"';
    return oss.str();
}

/**
 * Serialize a vector (1D array)
 * 
 * @param vec The vector to serialize
 * @return JSON-formatted array string
 */
template<typename T>
std::string serializeVector(const std::vector<T>& vec) {
    std::ostringstream oss;
    oss << '[';
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) oss << ',';
        // For strings, use string serialization; for others use primitive
        if constexpr (std::is_same_v<T, std::string>) {
            oss << serializeString(vec[i]);
        } else {
            oss << serializePrimitive(vec[i]);
        }
    }
    oss << ']';
    return oss.str();
}

// Specialization for string vectors
inline std::string serializeVector(const std::vector<std::string>& vec) {
    std::ostringstream oss;
    oss << '[';
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) oss << ',';
        oss << serializeString(vec[i]);
    }
    oss << ']';
    return oss.str();
}

/**
 * Serialize a 2D vector (matrix)
 * 
 * @param matrix The 2D vector to serialize
 * @return JSON-formatted 2D array string
 */
template<typename T>
std::string serialize2DVector(const std::vector<std::vector<T>>& matrix) {
    std::ostringstream oss;
    oss << '[';
    for (size_t i = 0; i < matrix.size(); ++i) {
        if (i > 0) oss << ',';
        oss << serializeVector(matrix[i]);
    }
    oss << ']';
    return oss.str();
}

/**
 * Serialize a binary tree to level-order array format
 * 
 * @param root Root node of the tree
 * @return Level-order array representation with null for missing nodes
 */
std::string serializeTreeNode(TreeNode* root);

/**
 * Serialize a linked list to array format
 * 
 * @param head Head node of the list
 * @return Array representation of list values
 */
std::string serializeListNode(ListNode* head);

/**
 * Serialize any value to JSON string
 * Helper that dispatches to appropriate serializer based on type
 * 
 * @tparam T The type of value to serialize
 * @param value The value to serialize
 * @return JSON-formatted string
 */
template<typename T>
std::string serializeJson(const T& value) {
    if constexpr (std::is_same_v<T, std::string>) {
        return serializeString(value);
    } else if constexpr (std::is_same_v<T, std::vector<std::string>>) {
        return serializeVector(value);
    } else if constexpr (std::is_same_v<T, TreeNode*>) {
        return serializeTreeNode(value);
    } else if constexpr (std::is_same_v<T, ListNode*>) {
        return serializeListNode(value);
    } else if constexpr (std::is_arithmetic_v<T>) {
        return serializePrimitive(value);
    } else {
        // For other vector types
        return serializeVector(value);
    }
}

// Include TreeNode and ListNode definitions for serialization functions
#include "structures.hpp"
#include <queue>

inline std::string serializeTreeNode(TreeNode* root) {
    if (!root) return "[]";
    
    std::vector<std::string> values;
    std::queue<TreeNode*> q;
    q.push(root);
    
    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();
        
        if (node) {
            values.push_back(std::to_string(node->val));
            q.push(node->left);
            q.push(node->right);
        } else {
            values.push_back("null");
        }
    }
    
    // Trim trailing nulls
    while (values.size() > 0 && values.back() == "null") {
        values.pop_back();
    }
    
    return serializeVector(values);
}

inline std::string serializeListNode(ListNode* head) {
    std::vector<int> values;
    ListNode* current = head;
    // Prevent infinite loops for circular lists
    int max_nodes = 10000;
    int count = 0;
    
    while (current && count < max_nodes) {
        values.push_back(current->val);
        current = current->next;
        count++;
    }
    
    return serializeVector(values);
}
