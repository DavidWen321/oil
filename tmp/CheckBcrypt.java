import cn.hutool.crypto.digest.BCrypt;

public class CheckBcrypt {
    public static void main(String[] args) {
        for (String hash : args) {
            try {
                System.out.println(hash + " => " + BCrypt.checkpw("admin123", hash));
            } catch (Exception e) {
                e.printStackTrace(System.out);
            }
        }
    }
}
