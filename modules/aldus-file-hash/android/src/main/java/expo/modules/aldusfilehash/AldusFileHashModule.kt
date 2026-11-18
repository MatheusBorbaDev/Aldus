package expo.modules.aldusfilehash

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * SHA-256 of a local book file, read as a stream off the JS thread (18/11/2026). Before this, the app read the file in base64 and
 * hashed it in JavaScript: minutes for a large PDF on a mid-range phone, with the JS thread stalling between chunks. The result is the
 * same lowercase hex digest the JavaScript path produces, plus the number of bytes read so the caller can confirm the whole file.
 * Only local files: content:// (Android providers) and file://. Never logs paths or contents.
 */
class AldusFileHashModule : Module() {
  private val cancelledOperations = ConcurrentHashMap.newKeySet<Int>()

  override fun definition() = ModuleDefinition {
    Name("AldusFileHash")

    AsyncFunction("cancelOperation") { operationId: Int ->
      cancelledOperations.add(operationId)
    }

    AsyncFunction("sha256File") Coroutine { uri: String, operationId: Int ->
      withContext(Dispatchers.IO) { sha256(uri, operationId) }
    }
  }

  private fun sha256(uriString: String, operationId: Int): Map<String, Any> {
    try {
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(1 shl 20)
      var size = 0L
      open(uriString).use { input ->
        while (true) {
          if (cancelledOperations.contains(operationId)) throw IllegalStateException("Assinatura do arquivo cancelada.")
          val read = input.read(buffer)
          if (read < 0) break
          digest.update(buffer, 0, read)
          size += read
        }
      }
      val hex = StringBuilder(64)
      for (byte in digest.digest()) {
        val value = byte.toInt() and 0xff
        hex.append(HEX[value ushr 4]).append(HEX[value and 0x0f])
      }
      return mapOf("hash" to hex.toString(), "size" to size.toDouble())
    } finally {
      cancelledOperations.remove(operationId)
    }
  }

  private fun open(uriString: String): InputStream {
    val context = appContext.reactContext ?: throw Exceptions.AppContextLost()
    val uri = Uri.parse(uriString)
    return when {
      uri.scheme == "content" -> context.contentResolver.openInputStream(uri)
      uri.scheme == "file" -> FileInputStream(File(requireNotNull(uri.path)))
      uri.scheme.isNullOrEmpty() -> FileInputStream(File(uriString))
      else -> null
    } ?: throw IllegalArgumentException("A assinatura requer um arquivo deste aparelho.")
  }

  private companion object {
    val HEX = "0123456789abcdef".toCharArray()
  }
}
