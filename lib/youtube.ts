/**
 * Extracts the YouTube video ID from various URL formats.
 * @param url - The YouTube URL.
 * @returns The video ID or null if not found.
 */
export const getYouTubeVideoId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('youtube.com')) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId) return videoId;
      if (parsedUrl.pathname.startsWith('/embed/')) {
        return parsedUrl.pathname.substring(7);
      }
    }
    if (parsedUrl.hostname.includes('youtu.be')) {
      return parsedUrl.pathname.substring(1);
    }
  } catch (e) {
    // Fallback for non-standard URLs
  }

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }

  return null;
};


/**
 * Validates a YouTube URL by checking if a video ID can be extracted.
 * @param url The URL to validate.
 * @returns An object indicating if the URL is valid, with an optional error message.
 */
export async function validateYoutubeUrl(
  url: string,
): Promise<{isValid: boolean; error?: string}> {
  if (getYouTubeVideoId(url)) {
    return {isValid: true};
  }
  return {isValid: false, error: 'Invalid YouTube URL. Please enter a valid URL (e.g., youtube.com/watch?v=... or youtu.be/...).'};
}

/**
 * Creates a YouTube embed URL from a standard YouTube URL.
 * @param url The original YouTube URL.
 * @returns The embeddable URL for use in an iframe.
 */
export function getYoutubeEmbedUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?rel=0`;
  }
  // Fallback, though unlikely to be reached if validateYoutubeUrl is used.
  return url;
}