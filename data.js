// data.js - Data fetching and processing for HN threads

// Constants
const MIN_COMMENT_LENGTH = 40;
const MAX_COMMENTS = 500;

/**
 * Fetch thread data from Algolia API
 * @param {string} threadId - HN thread ID
 * @returns {Promise<Object>} Raw thread data from Algolia
 */
export async function fetchThreadFromAlgolia(threadId) {
  const url = `https://hn.algolia.com/api/v1/items/${threadId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch thread data: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Process and filter thread data
 * @param {Object} rawData - Raw thread data from Algolia
 * @returns {Object} Processed thread data with filtered comments
 */
export function processThreadData(rawData) {
  const { id, title, children } = rawData;

  // Flatten all comments (including nested replies)
  const allComments = flattenComments(children || []);

  // Filter out very short comments and deleted/dead ones
  const filteredComments = allComments.filter((comment) => {
    if (!comment.text || comment.text.length < MIN_COMMENT_LENGTH) return false;
    if (comment.deleted || comment.dead) return false;
    return true;
  });

  // Limit comments to avoid token limits
  const limitedComments = filteredComments.slice(0, MAX_COMMENTS);

  // Map to simpler structure
  const comments = limitedComments.map((comment) => ({
    id: comment.id,
    author: comment.author,
    text: comment.text,
    points: comment.points || 0,
  }));

  return {
    thread_id: id,
    title: title || "Untitled",
    comments,
  };
}

/**
 * Recursively flatten nested comments
 * @param {Array} comments - Nested comments array
 * @param {Array} result - Accumulator for flattened results
 * @returns {Array} Flattened comments array
 */
function flattenComments(comments, result = []) {
  for (const comment of comments) {
    if (comment) {
      result.push(comment);
      if (comment.children && comment.children.length > 0) {
        flattenComments(comment.children, result);
      }
    }
  }
  return result;
}

/**
 * Parse LLM response into structured data
 * @param {string} rawResponse - Raw response from LLM
 * @returns {Object} Parsed analysis result
 */
export function parseAnalysisResponse(rawResponse) {
  try {
    // Try to extract JSON from response (in case LLM added markdown fences)
    let jsonText = rawResponse.trim();

    // Remove markdown code fences if present
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      lines.shift(); // Remove first ```
      lines.pop(); // Remove last ```
      jsonText = lines.join("\n");
    }

    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (error) {
    console.error("HN Distill: JSON parse error:", error);
    console.log("Raw response:", rawResponse);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

export default {
  fetchThreadFromAlgolia,
  processThreadData,
  parseAnalysisResponse,
};
